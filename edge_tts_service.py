import sys
import os
import json
import asyncio
import base64
import edge_tts

async def synthesize(text, voice="pt-BR-FranciscaNeural", pitch="+18Hz", rate="+5%"):
    try:
        communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate)
        # Collect audio bytes directly in memory
        audio_data = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])
        
        b64 = base64.b64encode(audio_data).decode("utf-8")
        return {
            "success": True,
            "audio": f"data:audio/mp3;base64,{b64}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No text provided"}))
        return
        
    text = sys.argv[1]
    voice = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else "pt-BR-FranciscaNeural"
    pitch = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else "+18Hz"
    rate = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else "+5%"
    
    result = await synthesize(text, voice, pitch, rate)
    print(json.dumps(result))

if __name__ == "__main__":
    asyncio.run(main())
