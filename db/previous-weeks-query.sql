WITH current_week AS (
  SELECT season, episode_number
  FROM survivor.week
  WHERE season = 49
    AND lock_time > NOW()      -- next locked
  ORDER BY lock_time ASC
  LIMIT 1
)
SELECT
    u.email,
    u.name AS user_name,
    s._fk_week_id AS week,
    s._fk_castaway_id AS castaway_id,
    c.name AS castaway_name,
    c.season,
    s.is_captain,
    s.source,
    s.created_at
FROM survivor.selection s
JOIN survivor.castaway c
    ON c.id = s._fk_castaway_id
JOIN survivor.user u
    ON u.id = s._fk_user_id
JOIN current_week cw
    ON cw.episode_number = s._fk_week_id
   AND cw.season = c.season
WHERE s.removed_at = '9999-12-31 23:59:59'
  AND c._fk_week_eliminated IS NULL
  AND c.season = 49;
