export async function getSelectionsForWeek(client, args, userRecord) {
  const weekId = JSON.parse(args).weekId
  const userId = userRecord.id
  const query = `
      SELECT id, _fk_user_id, _fk_week_id, _fk_castaway_id, is_captain, created_at, removed_at
      FROM survivor.selection 
      WHERE _fk_user_id = $1 
      AND _fk_week_id = $2 
      AND removed_at = '9999-12-31 23:59:59';
  `;
  try {
    const res = await client.query(query, [userId, weekId]);
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

export async function setSelections(client, args, userRecord) {
  const body = JSON.parse(args) // todo - not sure if this needed.
  const castaways = body.castaways // [{ castawayId, isCaptain }]
  const userId = userRecord.id
  const weekId = body['week'] // probably not a great parameterized thing.
  if (castaways.length > 1) {
    return {
      statusCode: 400,
      body: "Too many selections"
    }
  }
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
    VALUES ${castaways.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(", ")};
    `;

    const values = castaways.flatMap(({ castawayId, isCaptain }) => [userId, weekId, castawayId, isCaptain]);
    await client.query(query, values);

    await client.query("COMMIT;");

  } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
  }
}
