import { useCallback, useEffect, useState } from "react";
import { ErrorState, Loading } from "../../components/Feedback";
import { PageContainer, PageHeader } from "../../components/Page";
import { SettingRow, SettingsGroup } from "../../components/Settings";
import { api } from "../../lib/api";
import type { VersionInfo } from "../../lib/types";

export function AboutPage() {
  const [info, setInfo] = useState<VersionInfo>();
  const [error, setError] = useState<unknown>();
  const load = useCallback(async () => {
    try {
      setInfo(await api.versionInfo());
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <PageContainer size="standard">
      <PageHeader
        eyebrow="System"
        title="About AGH HA Controller"
        description="Build, compatibility, attribution, and project information."
      />
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      {!info && !error && <Loading label="Loading build information…" />}
      {info && (
        <SettingsGroup title="Build">
          <SettingRow title="Product" control="AGH HA Controller" />
          <SettingRow title="Version" control={<code>{info.version}</code>} />
          <SettingRow
            title="Build / commit"
            control={<code>{info.commit}</code>}
          />
          <SettingRow
            title="Build date"
            control={<span>{info.builtAt}</span>}
          />
          <SettingRow
            title="Database schema"
            control={<code>{info.databaseSchemaVersion}</code>}
          />
        </SettingsGroup>
      )}
      <SettingsGroup title="Project">
        <p>
          AGH HA Controller is an independent project. It is not AdGuard Home
          and is not an official AdGuard product.
        </p>
        <p>
          Supported managed configuration: AdGuard Home v0.107.52 on schema v1
          and reviewed v0.107.53–v0.107.78 contracts on schema v2. PostgreSQL 17
          and Debian 13/systemd or Docker Compose v2 are the current reference
          platforms.
        </p>
        <p>
          <a
            href="https://github.com/benchristian88/agh-ha-controller"
            target="_blank"
            rel="noreferrer"
          >
            Repository
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/benchristian88/agh-ha-controller/tree/dev/docs"
            target="_blank"
            rel="noreferrer"
          >
            Documentation
          </a>
        </p>
        <p>
          <strong>Licence:</strong> no final licence has been selected; the
          repository remains unlicensed pending the documented legal and
          commercial decision.
        </p>
      </SettingsGroup>
    </PageContainer>
  );
}
