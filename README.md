# Architecture Documentation

## System Overview

The ingestion pipeline is designed as a fault-tolerant, restart-safe data extraction system that retrieves events from the DataSync Analytics API and persists them into PostgreSQL.

The system prioritizes:

✔ Reliability
✔ Resumability
✔ Throughput efficiency
✔ Failure recovery

---

## High Level Architecture

### Core Components

1. Ingestion Service (Node.js + TypeScript)
   Responsible for API communication, pagination, retries, rate-limit handling, and persistence.

2. PostgreSQL Database
   Durable storage for events and ingestion state.

3. Ingestion State Table
   Tracks pipeline progress and recovery metadata.

---

## Data Flow

The ingestion loop follows a deterministic pipeline:

API Request → Pagination → Rate-Limit Adaptation → Retry Handling → Idempotent Insert → Checkpoint Save

Each stage is designed to tolerate transient failures without data loss.

---

## Persistence Strategy

### Events Table

All events are stored with:

✔ Primary key on id
✔ JSONB payload storage
✔ Normalized timestamp fields

To guarantee safe reprocessing:

ON CONFLICT (id) DO NOTHING

This ensures idempotency and replay safety.

---

### Ingestion State Table

Tracks pipeline progress using:

• Cursor
• Ingested count
• Last processed event ID
• Updated timestamp

This enables crash recovery and resumable execution.

---

## Resilience Mechanisms

### Cursor Expiry Handling

Observed behavior:

✔ Cursors expire (~116 seconds)
✔ Expired cursors return HTTP 400

Recovery strategy:

✔ Reset cursor
✔ Restart ingestion safely
✔ Enable catch-up optimization

---

### Retry Strategy

Transient failures handled:

✔ Gateway timeouts (504)
✔ Network failures
✔ Server errors (5xx)

Mitigation:

✔ Exponential backoff
✔ Bounded retry attempts
✔ No ingestion interruption

---

### Replay / Duplicate Detection

Observed behavior:

✔ API occasionally returns duplicate windows

Detection:

✔ inserted === 0

Mitigation:

✔ Automatic catch-up mode
✔ Skip redundant DB work
✔ Resume normal ingestion on new data

---

## Catch-Up Mode Optimization

When replay scenarios are detected:

✔ Inserts temporarily bypassed
✔ Pipeline fast-forwards through duplicates
✔ Normal ingestion resumes once new rows detected

This prevents wasted DB overhead during cursor resets.

---

## Rate-Limit Adaptation

Instead of static delays, request pacing dynamically adjusts using:

• x-ratelimit-remaining
• x-ratelimit-reset

This maximizes throughput while avoiding throttling errors.

---

## Failure Recovery Guarantees

The system guarantees:

✔ No duplicate corruption
✔ No data loss on restart
✔ Safe cursor recovery
✔ Continued ingestion after transient failures

---

## Scalability Considerations

While the API rate limit defines the upper throughput bound, the system is designed to scale via:

• Bulk insert optimizations (COPY)
• Parallel ingestion (if API permits partitioning)
• Backpressure-aware batching

---

## Design Philosophy

The architecture emphasizes real-world ingestion robustness, acknowledging that APIs often exhibit:

✔ Unstable cursors
✔ Expiring paginat
