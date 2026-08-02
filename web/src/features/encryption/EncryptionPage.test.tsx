// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type { Cluster, ConfigurationSnapshot, Node } from "../../lib/types";
import { EncryptionPage } from "./EncryptionPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cluster = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home",
} as Cluster;

const node = {
  id: "22222222-2222-4222-8222-222222222222",
  clusterId: cluster.id,
  name: "Primary",
} as Node;

describe("EncryptionPage", () => {
  it("shows only redacted node-attributed TLS inventory", async () => {
    const snapshot = {
      id: "33333333-3333-4333-8333-333333333333",
      nodeId: node.id,
      observedAt: "2026-08-02T00:00:00Z",
      schemaVersion: 2,
      collectionStatus: "succeeded",
      document: {
        observedOnly: {
          tls: {
            enabled: true,
            serverName: "dns.example.test",
            httpsPort: 443,
            dnsOverTlsPort: 853,
            dnsOverQuicPort: 853,
            validPair: true,
          },
        },
      },
    } as ConfigurationSnapshot;
    vi.spyOn(api, "configurationInventory").mockResolvedValue({
      schemaVersion: 2,
      snapshots: [snapshot],
      capabilities: [],
    });
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [node],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });

    render(<EncryptionPage cluster={cluster} />);

    expect(await screen.findByText("Primary")).toBeTruthy();
    expect(screen.getByText("dns.example.test")).toBeTruthy();
    expect(screen.getByText("443 / 853 / 853")).toBeTruthy();
    expect(screen.queryByText(/private key|certificate path/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("renders an explicit empty observation state", async () => {
    vi.spyOn(api, "configurationInventory").mockResolvedValue({
      schemaVersion: 2,
      snapshots: [],
      capabilities: [],
    });
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [node],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });

    render(<EncryptionPage cluster={cluster} />);

    expect(await screen.findByText("No TLS observations")).toBeTruthy();
  });
});
