WITH current_week AS (
  SELECT season, episode_number
  FROM survivor.week
  WHERE season = 49
    AND lock_time <= NOW()
  ORDER BY lock_time DESC
  LIMIT 1
)
INSERT INTO survivor.selection (
  _fk_user_id,
  _fk_week_id,
  _fk_castaway_id,
  is_captain,
  source,
  _fk_season
)
SELECT
  s._fk_user_id,
  cw.episode_number + 1 AS _fk_week_id,
  s._fk_castaway_id,
  s.is_captain,
  'AUTO' AS source,
  c.season
FROM survivor.selection s
JOIN survivor.castaway c
  ON c.id = s._fk_castaway_id
JOIN current_week cw
  ON s._fk_week_id = cw.episode_number
 AND c.season = cw.season
WHERE s.removed_at = '9999-12-31 23:59:59'
  AND c._fk_week_eliminated IS NULL
  AND cw.season = 49
  AND NOT EXISTS (
      SELECT 1
      FROM survivor.selection s2
      JOIN survivor.castaway c2
        ON c2.id = s2._fk_castaway_id
      WHERE s2._fk_user_id = s._fk_user_id
        AND s2._fk_week_id = cw.episode_number + 1
        AND s2.removed_at = '9999-12-31 23:59:59'
        AND c2.season = cw.season
  );
