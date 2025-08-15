import jwt
import time

def generate_apple_jwt():
    # Replace these values with your actual Apple Developer information
    team_id = "YOUR_TEAM_ID_HERE"  # Found in Apple Developer Portal -> Your App -> App ID Prefix
    client_id = "com.diyagirishkumar.blii"  # Your bundle ID
    key_id = "YOUR_KEY_ID_HERE"  # 10-character Key ID from .p8 key
    p8_file_path = "path/to/your/AuthKey_KEYID.p8"  # Path to your .p8 file
    
    # Read the private key
    with open(p8_file_path, "r") as f:
        private_key = f.read()
    
    # Create timestamps
    validity_minutes = 20  # Apple allows max 20 minutes
    timestamp_now = int(time.time())
    timestamp_exp = timestamp_now + (60 * validity_minutes)
    
    # Create payload
    payload = {
        "iss": team_id,
        "iat": timestamp_now,
        "exp": timestamp_exp,
        "aud": "https://appleid.apple.com",
        "sub": client_id
    }
    
    # Generate JWT token
    token = jwt.encode(
        payload=payload, 
        key=private_key, 
        algorithm="ES256", 
        headers={"kid": key_id}
    )
    
    # Handle different PyJWT versions
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    print("Generated JWT Token:")
    print(token)
    print(f"\nToken expires at: {time.ctime(timestamp_exp)}")
    
    return token

if __name__ == "__main__":
    generate_apple_jwt()
