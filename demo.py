from flask import Flask, request, jsonify
import re
import json
import uuid
from datetime import date
from openai import OpenAI
import threading
import base64
import io

app = Flask(__name__)

api_key = "sk-B9aJzkfWO3xjl6FO53AeD7A6D9F64a7e971dB43111E4Cd69"
base_url = "https://api.bltcy.ai/v1"

client = OpenAI(
    api_key=api_key,
    base_url=base_url
)

# JSON string as system prompt
system_prompt = str({
    "role": "AlzheimerVisitaAID helper",
    "language": "Chinese",
    "information": {
        "date": str(date.today()),
        "location": "Beijing",
    },
    "tasks": [
        "First, Generate images for Classification Test",
        "MOCA (Montreal Cognitive Assessment)",
        "ADAS-Cog (Alzheimer's Disease Assessment Scale-Cognitive Subscale)",
        "MMSE (Mini-Mental State Examination)",
        "Clock Drawing Test(once)",
        "Classification Test with generated images(once or twice)"
    ],
    "tips": [
        "Communicate solely in Chinese",
        "Explain and introduce each test section briefly",
        "Ask questions one at a time",
        "Generate images for Classification Test",
        "Use accessible language for non-medical users",
        "Avoid mentioning specific model names or technologies",
        "Avoid tasks involving drawing lines to connect numbers or letters",
        "Start tests immediately without asking if users are ready",
        "Proceed with tasks without unnecessary pauses",
        "Adapt questions if user shows difficulty understanding",
        "Provide clear instructions for each task",
        "Offer encouragement throughout the assessment",
        "Present the report directly at the end, instead of making users wait for the report to be generated."
    ],
    "report": [
        "Analyze user's performance in all tests",
        "Offer preliminary suggestions based on performance",
        "Estimate likelihood of Alzheimer's disease",
        "Emphasize need for professional medical advice",
        "Provide guidance on subsequent steps",
        "Present results in easy-to-understand format",
        "Suggest lifestyle changes that may be beneficial",
    ]
})

simple_system_prompt = '''
{
  "role": "AlzheimerVisitaAID helper",
  "language": "Chinese",
  "tips": [
    "Use accessible language for non-medical users",
    "Start tests immediately without asking if users are ready",
    "Proceed with tasks without unnecessary pauses",
    "Adapt questions if user shows difficulty understanding",
    "Provide clear instructions for each task",
    "Offer encouragement throughout the assessment"
  ],
  "report": [
    "Analyze user's performance in all tests",
    "Offer preliminary suggestions based on performance",
    "Estimate likelihood of Alzheimer's disease",
    "Emphasize need for professional medical advice",
    "Provide guidance on subsequent steps",
    "Present results in easy-to-understand format",
    "Suggest lifestyle changes that may be beneficial",
  ]
}
'''

json_prompt = '''
Your response have to follow this format:
    {
    "answer": "",
    "need_generate_image": true or false,
    "image_description": "",
    }
    YOUR REPLY MUST BE DIRECTLY PARSABLE AS JSON!
    DON'T PUT ILLEGAL CHARACTERS IN ANSWER!
'''

assistant_prompt = "你好!欢迎使用 AlzheimerVisitaAid 测试。这个测试会帮助您进行初步的阿尔茨海默病评估。但请注意，这不是用来替代专业医疗建议的工具，我们强烈建议与医疗专业人士咨询获得全面的诊断。在任何时候都可以说出“开始测试”，开始您的阿尔茨海默病初步评估。"

conversations = {}


def generate_image(prompt):
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        print(response)
        return response.data[0].url
    except Exception as e:
        print(f'Error generating image: {e}')
        return None


def generate_image_async(cid, image_description):
    image_url = generate_image(image_description)
    if image_url:
        conversations[cid][-1]["image_url"] = image_url
        conversations[cid][-1]["image_status"] = "ready"
    else:
        conversations[cid][-1]["image_status"] = "failed"


def generate_audio(text):
    try:
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text
        )

        # Convert the audio content to base64
        buffer = io.BytesIO()
        for chunk in response.iter_bytes():
            buffer.write(chunk)
        buffer.seek(0)
        audio_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return audio_base64
    except Exception as e:
        print(f'Error generating audio: {e}')
        return None


def get_gpt_response(messages, cid, max_retries=5):
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model='claude-3-5-sonnet',
                messages=messages,
                max_tokens=4096
            )
            print(response)
            result = response.choices[0].message.content.strip()
            print("---------------------------------------------------------------")
            print(result)
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                result_dict = json.loads(json_match.group(0))
                if result_dict.get("need_generate_image", False):
                    result_dict["image_status"] = "generating"
                    threading.Thread(target=generate_image_async,
                                     args=(cid, result_dict.get("image_description", ""))).start()

                # Generate audio for the answer
                audio_base64 = generate_audio(result_dict.get("answer", ""))
                result_dict["audio_base64"] = audio_base64

                return result_dict
            print(f"No JSON found in response. Attempt {attempt + 1} of {max_retries}")
        except json.JSONDecodeError:
            print(f"Received non-JSON response. Attempt {attempt + 1} of {max_retries}")
        if attempt < max_retries - 1:
            messages.append({"role": "system", "content": assistant_prompt})
    print("Failed to get JSON response after maximum retries.")
    raise Exception("Failed to get valid response")


@app.route('/create', methods=['POST'])
def create_conversation():
    data = request.json
    cid = data.get('cid', '')
    input_type = data.get('input_type', '')
    input_content = data.get('input_content', '')

    print(data)
    print("Creating conversation")

    if not cid:
        cid = str(uuid.uuid4())

    if cid not in conversations:
        conversations[cid] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json_prompt},
            {"role": "assistant", "content": assistant_prompt}
        ]

    print(conversations[cid])

    if input_type == 'text':
        conversations[cid].append({"role": "user", "content": input_content})
    elif input_type == 'image':
        # 确保 input_content 是有效的 base64 字符串
        if not input_content.startswith('data:image'):
            input_content = f"data:image/jpeg;base64,{input_content}"

        conversations[cid].append({
            "role": "user",
            "content": [
                {"type": "text",
                 "text": "My drawing is uploaded, evaluate whether my image meet the need and continue the test."},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": input_content
                    }
                }
            ]
        })

    try:
        result_dict = get_gpt_response(conversations[cid], cid)
        answer = result_dict.get("answer", "")
        need_generate_image = result_dict.get("need_generate_image", False)
        image_status = result_dict.get("image_status", "")
        audio_base64 = result_dict.get("audio_base64", "")

        # 创建一个新的字典，不包含 audio_base64
        history_dict = {k: v for k, v in result_dict.items() if k != 'audio_base64'}

        # 将不包含 audio_base64 的响应添加到对话历史
        conversations[cid].append({"role": "assistant", "content": json.dumps(history_dict)})
        conversations[cid].append({"role": "system", "content": json_prompt})
        conversations[cid].append({"role": "system", "content": simple_system_prompt})

        return jsonify({
            'response': answer,
            'cid': cid,
            'need_generate_image': need_generate_image,
            'image_status': image_status,
            'audio_base64': audio_base64
        })
    except Exception as e:
        print(f'Error occurred: {e}')
        return jsonify({'error': str(e), 'cid': cid}), 500


@app.route('/check_image', methods=['GET'])
def check_image():
    cid = request.args.get('cid')
    if cid in conversations and conversations[cid][-1].get("image_status") == "ready":
        return jsonify({
            'image_url': conversations[cid][-1].get("image_url"),
            'image_status': 'ready'
        })
    elif cid in conversations and conversations[cid][-1].get("image_status") == "failed":
        return jsonify({
            'image_status': 'failed'
        })
    else:
        return jsonify({
            'image_status': 'generating'
        })


if __name__ == '__main__':
    print("running")
    app.run(host='0.0.0.0', port=7799, debug=False)
