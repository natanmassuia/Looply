# Assistant Calendar and Ticket Integration (A1)

This document tracks the incremental features of the A1 epic.

## Calendar Projection (A1.2)

O Calendar projeta os seguintes eventos, respeitando sempre o limite de 500 itens globais e restrições de tenant:
- **Job publication target** (`PUBLICATION_TARGET`)
- **Job scheduledAt** (`SCHEDULED`)
- **Appointment** (`APPOINTMENT`)

A estrutura do `Appointment` é combinada deterministicamente aos eventos de Job na linha do tempo.

*(Note: Ticket Assistant adapter is not yet implemented. Refer to A1.3 for Ticket mapping).*
