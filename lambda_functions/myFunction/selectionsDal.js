import { SEASON_NUMBER, getWeek, argWeekOrCurrent } from './weekDal.js'

export async function getSelectionsForWeek(client, args, userRecord) {
  const weekId = JSON.parse(args).week
  const query = `
      SELECT s.id, s._fk_user_id, s._fk_week_id, s._fk_castaway_id, 
             s.is_captain, s.created_at, s.removed_at
      FROM survivor.selection s
      JOIN survivor.week w 
        ON s._fk_week_id = w.episode_number
       AND s._fk_season = w.season
      WHERE s._fk_week_id = $1
        AND s._fk_season = $2
        AND s.removed_at = '9999-12-31 23:59:59';
  `;
  try {
    const res = await client.query(query, [weekId, SEASON_NUMBER]);
    return { statusCode: 200, body: res.rows };
  } catch (err) {
    console.error("Error getting selections for week:", err);
    return { statusCode: 500, body: "Something went wrong" };
  }
}

// returns { castaways: castawaysWithSelections, week: weekRecord }
export async function getCastawaysWithSelections(client, args, userRecord) {
  const weekId = await argWeekOrCurrent(client, args)
  const userId = userRecord.id;
  const week = await getWeek(client, weekId)

  const query = `
    SELECT 
      c.id, c.name, c.season, c.image_url, c._fk_week_eliminated, 
      s.id AS selection_id, s.is_captain, s.created_at, s.removed_at
    FROM survivor.castaway c
    LEFT JOIN survivor.selection s 
      ON c.id = s._fk_castaway_id 
     AND s._fk_user_id = $1 
     AND s._fk_week_id = $2 
     AND s._fk_season = $3
     AND s.removed_at = '9999-12-31 23:59:59'
    WHERE c.season = $3;
  `;
  try {
    const res = await client.query(query, [userId, weekId, SEASON_NUMBER]);
    return { statusCode: 200, body: { castaways: res.rows, week } };
  } catch (err) {
    console.error("Error getting castaways with selections:", err);
    return { statusCode: 500, body: "Something went wrong" };
  }
}

export async function allSelectionsForUser(client, args, userRecord) {
  const userId = userRecord.id;
  const query = `
    SELECT 
      c.id, c.name, c.season, c.image_url, c._fk_week_eliminated, 
      s.id AS selection_id, s.is_captain, s.created_at, s.removed_at
    FROM survivor.selection s 
    JOIN survivor.castaway c ON c.id = s._fk_castaway_id 
    WHERE s._fk_user_id = $1 
      AND s._fk_season = $2
      AND s.removed_at = '9999-12-31 23:59:59';
  `;
  try {
    const res = await client.query(query, [userId, SEASON_NUMBER]);
    return { statusCode: 200, body: res.rows };
  } catch (err) {
    console.error("Error getting all selections for user:", err);
    return { statusCode: 500, body: "Something went wrong" };
  }
}

// castaways is [{ castawayId, isCaptain }]
export async function setSelections(client, weekId, castaways, userRecord) {
  const userId = userRecord.id
  if (castaways.length > 1) {
    return { statusCode: 400, body: "Too many selections" }
  }
  try {
    await client.query("BEGIN;");
    
    await client.query(
      `UPDATE survivor.selection
        SET removed_at = NOW()
        WHERE _fk_user_id = $1
          AND _fk_week_id = $2
          AND _fk_season  = $3
          AND removed_at = '9999-12-31 23:59:59';
`,
      [userId, weekId, SEASON_NUMBER]
    );
    
    const query = `
      INSERT INTO survivor.selection (_fk_user_id, _fk_week_id, _fk_castaway_id, is_captain, source, _fk_season)
      VALUES ${castaways.map((_, i) => 
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, 'USER', $${i * 5 + 5})`
      ).join(", ")}
      RETURNING id, _fk_user_id, _fk_week_id, _fk_castaway_id, is_captain, source, created_at, removed_at, _fk_season;
    `;
    const values = castaways.flatMap(({ castawayId, isCaptain }) => [
      userId, weekId, castawayId, isCaptain, SEASON_NUMBER
    ]);
    const insertResult = await client.query(query, values);

    await client.query("COMMIT;");
    return { statusCode: 200, body: insertResult.rows };
  } catch (error) {
    await client.query("ROLLBACK;");
    throw error;
  }
}

export async function getAllActiveSelections(client, args, userRecord) {
  const query = `
    SELECT
      u.id AS user_id,
      u.email AS user_email,
      u.name AS user_name,
      c.id AS castaway_id,
      c.image_url AS castaway_image_url,
      s.id AS selection_id,
      s._fk_week_id,
      s.is_captain,
      s.created_at,
      s.removed_at,
      w.lock_time
    FROM survivor.selection s
    JOIN survivor.user u ON s._fk_user_id = u.id
    JOIN survivor.castaway c ON s._fk_castaway_id = c.id
    JOIN survivor.week w 
      ON s._fk_week_id = w.episode_number
     AND s._fk_season = w.season
    WHERE s.removed_at = '9999-12-31 23:59:59'
      AND w.season = $1
    ORDER BY s._fk_week_id, u.name;
  `;
  try {
    const res = await client.query(query, [SEASON_NUMBER]);
    const body = res.rows.map((row) => {
      const isLocked = row.lock_time < new Date();
      return {
        user_id: row.user_id,
        user_email: row.user_email,
        user_name: row.user_name,
        castaway_id: isLocked ? row.castaway_id : null,
        castaway_image_url: isLocked ? row.castaway_image_url : null,
        selection_id: row.selection_id,
        _fk_week_id: row._fk_week_id,
        is_captain: isLocked ? row.is_captain : false,
        created_at: row.created_at,
        removed_at: row.removed_at,
      };
    });
    return { statusCode: 200, body };
  } catch (err) {
    console.error("Error getting all active selections:", err);
    return { statusCode: 500, body: "Something went wrong" };
  }
}
