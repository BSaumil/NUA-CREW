# ADR-005: Ingestion fails closed

**Status:** accepted. A source can only be fetched if it is `active` and has an unrevoked, in-window `source_permissions` row whose `permitted_fields` cover the minimum display set. Fields outside the grant are dropped before storage. Rejected runs are recorded and audited. Revocation unpublishes everything the source supplied. `robots.txt` is never treated as authorisation. Third-party text is stripped of markup and treated as data; it cannot change trust state. Only a fixture connector exists; any future network connector must call `assert_safe_url`.
