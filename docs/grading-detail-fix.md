# Auto-grading detail feedback fix

This patch updates the DTW auto-grading flow to match the professor's requirement: the system comment must not show only the score. It now stores one extra `detail_mistakes` field containing a static HTML link.

## What changed

- `triggerPoseGrading()` still compares:
  - teacher left video vs student left video,
  - teacher right video vs student right video,
  - then averages the two scores.
- After scoring, the backend generates a static HTML report file at:

```text
public/grading-details/<student-post-id>.html
```

- The system grading comment saves `detailMistakes` as a clickable HTML link such as:

```html
<a href="/it4788/static/grading-details/<student-post-id>.html" target="_blank">Xem chi tiết lỗi sai DTW</a>
```

- The linked HTML report contains:
  - final average score,
  - left/right video score,
  - left/right DTW raw distance,
  - mistake list / feedback for each side,
  - overall summary.
- `main.ts` serves the generated files through:

```text
/it4788/static/grading-details/<student-post-id>.html
```

## Rich feedback support

If the grading server returns richer fields in `job_output`, such as `detail_mistakes`, `mistakes`, `errors`, `feedback`, `analysis`, `body_part_errors`, `joint_errors`, `angle_errors`, `keypoint_errors`, or `worst_frames`, the backend includes them in the static HTML report.

If the grading server only returns `score` and `raw_distance`, the backend still creates useful Vietnamese feedback based on the score and DTW distance, so students do not see only a number.

## Files changed

```text
src/main.ts
src/posts/posts.service.ts
test/posts/add-post.service.spec.ts
docs/grading-api.md
docs/grading-detail-fix.md
.env.example
.gitignore
```

The database schema already had `comments.detail_mistakes`, and `get_comment` already returned it as `detail_mistakes`, so no database migration is needed.
