# ADR-0033: License Atlas DNS Controller under Business Source License 1.1

Status: Accepted

Date: 2026-08-12

Supersedes: ADR-0020

## Context

The pre-1.0 project deferred licensing while the owner considered homelab use,
external contributions, commercial hosting and resale, and a later open-source
licence. Release 1.0 needs explicit terms before source, binaries, container
images, and documentation can be distributed as a supported product.

## Decision

Atlas DNS Controller is licensed under the Business Source License 1.1
(`BUSL-1.1`) with these parameters:

- Licensor: Atlas.
- Licensed Work: Atlas DNS Controller and all modifications/versions prior to
  the Change Date.
- Additional Use Grant: non-commercial, personal, and homelab environments;
  commercial hosting or resale is prohibited.
- Change Date: August 12, 2032.
- Change License: Apache License, Version 2.0.

The canonical licence text also applies its earlier fourth-anniversary trigger
separately to each publicly distributed version. The repository is therefore
source-available, not open source, while BUSL-1.1 governs a version.

## Consequences

- Every source and release distribution includes the root `LICENSE` file.
- Package, image, SBOM, and repository metadata use SPDX identifier
  `BUSL-1.1` while that licence applies.
- Product documentation must not describe the BUSL-governed release as open
  source.
- The Additional Use Grant does not authorize commercial hosting or resale.
- Uses outside the current grant require separate permission from the Licensor
  or must wait for the applicable Change License.
- Contribution terms remain subject to BUSL-1.1 and project review.
