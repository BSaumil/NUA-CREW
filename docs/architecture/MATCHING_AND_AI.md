# Matching and AI

**Implemented:** `app/services/matching.py` — deterministic, explainable estimate. Spec weights: semantic 30, skills 25, experience 15, commute 10, salary 10, preference 5, trajectory 5. Only **skills, commute (suburb/postcode/state proxy), salary (normalised to hourly, 38h week), preference** are evaluated today; the rest are returned as `not_evaluated` and excluded from the denominator rather than guessed. Output is labelled "Estimated match — not a prediction of being hired". Only gate: job must be open.

**Not implemented:** semantic retrieval/pgvector, RRF, experience/trajectory, resume parsing, tailoring, interview practice, LLM adapter, evals (Recall@K/NDCG), fairness diagnostics, usage/cost accounting. Employer applicant lists are ordered by application time; **no AI ranking is shown to employers**.

**Principles carried into code:** scores are never hire probabilities; employers make every decision (`StatusChangeIn` requires a human reason to reject); candidate data is not used to train third-party models (no AI calls exist).
