import { getWeek } from './weekDal.js'

export async function getSelectionsForWeek(client, args, userRecord) {
  const weekId = JSON.parse(args).week
  const query = `
      SELECT id, _fk_user_id, _fk_week_id, _fk_castaway_id, is_captain, created_at, removed_at
      FROM survivor.selection 
      AND _fk_week_id = $1 
      AND removed_at = '9999-12-31 23:59:59';
  `;
  try {
    const res = await client.query(query, [weekId]);
    return {
      statusCode: 200,
      body: res.rows
    }
  } catch (err) {
    console.log(err)
    console.log("error getting selections for week")
    return {
      status: 500,
      body: "Something went wrong"
    }
  }
}

// returns { castaways: castawaysWithSelections, week: weekRecord }
export async function getCastawaysWithSelections(client, args, userRecord) {
  const weekId = JSON.parse(args).week;
  const userId = userRecord.id;
  const week = await getWeek(client, weekId)

  const query = `
    SELECT 
      c.id, 
      c.name, 
      c.season, 
      c.image_url, 
      c._fk_week_eliminated, 
      s.id AS selection_id, 
      s.is_captain, 
      s.created_at, 
      s.removed_at
    FROM survivor.castaway c
    LEFT OUTER JOIN survivor.selection s 
      ON c.id = s._fk_castaway_id 
      AND s._fk_user_id = $1 
      AND s._fk_week_id = $2 
      AND s.removed_at = '9999-12-31 23:59:59';
  `;

  try {
    const res = await client.query(query, [userId, weekId]);
    return {
      statusCode: 200,
      body: {
        castaways: res.rows,
        week: week
      }
    };
  } catch (err) {
    console.error("Error getting castaways with selections:", err);
    return {
      statusCode: 500,
      body: "Something went wrong"
    };
  }
}

export async function allSelectionsForUser(client, args, userRecord) {
  const userId = userRecord.id;
  const query = `
    SELECT 
      c.id, 
      c.name, 
      c.season, 
      c.image_url, 
      c._fk_week_eliminated, 
      s.id AS selection_id, 
      s.is_captain, 
      s.created_at, 
      s.removed_at
    FROM survivor.selection s 
      JOIN survivor.castaway c
      ON c.id = s._fk_castaway_id 
    WHERE
      s._fk_user_id = $1 
      AND s.removed_at = '9999-12-31 23:59:59';
  `;

  try {
    const res = await client.query(query, [userId]);
    return {
      statusCode: 200,
      body: res.rows
    };
  } catch (err) {
    console.error("Error getting castaways with selections:", err);
    return {
      statusCode: 500,
      body: "Something went wrong"
    };
  }
}

// castaways is [{ castawayId, isCaptain }]
export async function setSelections(client, weekId, castaways, userRecord) {
  const userId = userRecord.id
  if (castaways.length > 1) {
    return {
      statusCode: 400,
      body: "Too many selections"
    }
  }
  console.log(castaways)
  // todo: more validation, especially around what week we are setting selections for.
  try {
    await client.query("BEGIN;");
    

    await client.query(
        `UPDATE survivor.selection 
          SET removed_at = NOW()
          WHERE _fk_user_id = $1 
          AND _fk_week_id = $2 
          AND removed_at = '9999-12-31 23:59:59';`,
        [userId, weekId]
    );
    
    
    const query = `
      INSERT INTO survivor.selection (_fk_user_id, _fk_week_id, _fk_castaway_id, is_captain)
      VALUES ${castaways.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(", ")}
      RETURNING id, _fk_user_id, _fk_week_id, _fk_castaway_id, is_captain, created_at, removed_at;
    `;


    const values = castaways.flatMap(({ castawayId, isCaptain }) => [userId, weekId, castawayId, isCaptain]);
    const insertResult = await client.query(query, values);

    await client.query("COMMIT;");
    return {
      statusCode: 200,
      body: insertResult.rows
    }

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
    s.removed_at
  FROM survivor.selection s
  JOIN survivor.user u ON s._fk_user_id = u.id
  JOIN survivor.castaway c ON s._fk_castaway_id = c.id
  JOIN survivor.week w ON s._fk_week_id = w.episode_number  -- Ensure correct join condition
  WHERE s.removed_at = '9999-12-31 23:59:59'
  AND w.lock_time < NOW();
  `
  try {
    const res = await client.query(query);
    return {
      statusCode: 200,
      body: res.rows
    };
  } catch (err) {
    console.error("Error getting castaways with selections:", err);
    return {
      statusCode: 500,
      body: "Something went wrong"
    };
  }
}
