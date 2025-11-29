#!/usr/bin/env python3
"""
Test script for the updated verify endpoint functionality
"""
import asyncio
import aiohttp
import json

async def test_verify_endpoint():
    """Test the verify endpoint with different scenarios"""
    
    base_url = "http://localhost:8000"
    
    # Test data
    test_cases = [
        {
            "name": "Test with non-existent video URL",
            "video_url": "https://www.youtube.com/watch?v=nonexistent123",
            "expected_status": 404
        },
        {
            "name": "Test with valid video URL format",
            "video_url": "https://www.youtube.com/watch?v=test456",
            "expected_status": "pending"  # or other status depending on DB state
        }
    ]
    
    async with aiohttp.ClientSession() as session:
        for test_case in test_cases:
            print(f"\n=== {test_case['name']} ===")
            
            # Prepare request data
            request_data = {
                "video_url": test_case['video_url']
            }
            
            try:
                # Make request to verify endpoint
                async with session.post(
                    f"{base_url}/verify",
                    json=request_data,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    
                    status_code = response.status
                    response_data = await response.json()
                    
                    print(f"Status Code: {status_code}")
                    print(f"Response: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
                    
                    # Check expected status
                    if status_code == test_case['expected_status'] or response_data.get('status') == test_case.get('expected_status'):
                        print("✅ Test PASSED")
                    else:
                        print("❌ Test FAILED")
                        
            except aiohttp.ClientConnectorError:
                print("❌ Connection Error: Make sure the FastAPI server is running on localhost:8000")
                print("   Start the server with: uvicorn app:app --host 0.0.0.0 --port 8000 --reload")
                break
            except Exception as e:
                print(f"❌ Request Error: {e}")

if __name__ == "__main__":
    print("Testing updated verify endpoint...")
    print("Make sure to start the FastAPI server first:")
    print("uvicorn app:app --host 0.0.0.0 --port 8000 --reload")
    print()
    
    asyncio.run(test_verify_endpoint())