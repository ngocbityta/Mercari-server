# Auto-grading detail feedback fix

This patch changes the auto DTW grading flow so the score comment no longer stores only raw distances.

## What changed

- `triggerPoseGrading()` now saves `detailMistakes` as a static HTML block.
- The HTML contains:
  - average score,
  - left/right video scores,
  - left/right raw DTW distance,
  - a list of mistake comments for each side,
  - an overall summary.
- If the grading server later returns richer fields in `job_output`, such as `detail_mistakes`, `mistakes`, `errors`, `feedback`, or `analysis`, the backend will use those real details inside the HTML.
- If the grading server only returns `score` and `raw_distance`, the backend still creates useful Vietnamese feedback based on the score and DTW distance.

## Main file changed

```text
src/posts/posts.service.ts
```

The database schema already had `comments.detail_mistakes`, and `get_comment` already returned it as `detail_mistakes`, so no database migration is needed.
