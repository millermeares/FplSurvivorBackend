use lambda_runtime::{service_fn, LambdaEvent, Error};
use serde_json::{json, Value};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = service_fn(handler);
    lambda_runtime::run(func).await
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (event_payload, _context) = event.into_parts();
    println!("Received event: {:?}", event_payload);

    Ok(json!({
        "message": "Hello from Rust Lambda!"
    }))
}
