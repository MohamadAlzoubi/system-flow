# Service Availability and Outage Simulation

Every node can define one shared availability policy:

- `online`: normal configured capacity.
- `offline`: zero capacity for the complete simulation.
- `degraded`: capacity is multiplied by the configured percentage.
- `scheduled`: capacity becomes zero at the configured start, remains offline for the
  outage duration, then increases linearly during recovery.

Availability affects node throughput, downstream traffic, queue consumer capacity,
and failover target health. The replay timeline exposes `online`, `offline`,
`degraded`, and `recovering` states with the available capacity percentage.

Examples:

- Taking Redis offline stops its normal downstream output. A separately modeled
  fallback branch can route traffic to the database.
- Taking a worker offline reduces queue consumer capacity to zero, causing backlog,
  expiration, overflow, and dead-letter behavior according to queue configuration.
- A scheduled outage allows analysis of backlog growth during downtime and draining
  after capacity recovers.

The simulator does not invent fallback connections. Cache bypass, secondary services,
and regional failover must be represented explicitly as graph edges and routing
policies.
