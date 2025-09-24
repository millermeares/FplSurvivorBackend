### Building and Packaging the Lambda Function


1. Install the Linux target (only needed once):
```
rustup target add x86_64-unknown-linux-gnu && cargo install cross
```

2. Build the project for the Linux target:
```
cargo build --release --target x86_64-unknown-linux-gnu
```

3. Copy the compiled binary to a file named bootstrap:
```
cp target/x86_64-unknown-linux-gnu/release/myRustFunction bootstrap
```
4. Create a zip file containing the bootstrap file:
```
zip lambda.zip bootstrap
```