const CASTAWAY_EVENTS_SCORING = {
  'NON_IMMUNITY_WIN': 1,
  'FIND_IDOL': 1,
  'PLAY_IDOL': 1,
  'PROTECTED_BY_IDOL': 1,
  'VOTE_FOR_EXILED': 1,
  'WON_IMMUNITY': 2,
  'VOTE_RECEIVED': -1
}

// const CASTAWAY_EVENTS = CASTAWAY_EVENTS_SCORING.keys()


export async function getCastawayEventsWithScoring(client, args, userRecord) {
  const events = await getAllCastawayEvents(client)
  if (events.statusCode != 200) {
    console.log(events)
    return events
  }
  return {
    statusCode: events.statusCode,
    body: {
      events: events.body,
      scoring: CASTAWAY_EVENTS_SCORING
    }
  }
}

// todo: at some point, season will need to be parameter here.
async function getAllCastawayEvents(client) {
  const query = `
  SELECT 
    c.id AS castaway_id,
    c.name AS castaway_name,
    w.season,
    w.episode_number,
    ce.event_type,
    ce.created_at
    FROM survivor.castaway c
    CROSS JOIN survivor.week w
  LEFT JOIN survivor.castaway_event ce 
      ON ce._fk_castaway_id = c.id
      AND ce.week = w.episode_number
      AND ce.removed_at = '9999-12-31 23:59:59'
  WHERE w.lock_time <= NOW()
  ORDER BY c.name, w.season, w.episode_number, ce.created_at;
  `
  try {
    const res = await client.query(query);
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
