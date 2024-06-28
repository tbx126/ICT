from flask import Flask, request, jsonify
import re
import json
import uuid
from datetime import date
from openai import OpenAI

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
      "date": str(date.today()) ,
      "location": "Beijing",
  },
  "tasks": [
    "MOCA (Montreal Cognitive Assessment)",
    "ADAS-Cog (Alzheimer's Disease Assessment Scale-Cognitive Subscale)",
    "MMSE (Mini-Mental State Examination)",
    "Clock Drawing Test",
    "Classification Test with generated images"
  ],
  "tips": [
    "Communicate solely in Chinese",
    "Explain and introduce each test section briefly",
    "Ask questions one at a time",
    "Generate images for Classification Test",
    "Use accessible language for non-medical users",
    "Avoid mentioning specific model names or technologies",
    "Do not require users to upload drawings",
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

print(str(date.today()))

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
    "has_image": true or false,
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

def get_gpt_response(messages, max_retries=5):
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
                if result_dict.get("has_image", False):
                    image_url = generate_image(result_dict.get("image_description", ""))
                    if image_url:
                        result_dict["image_url"] = image_url
                    else:
                        result_dict["has_image"] = False
                        result_dict["answer"] += " (图片生成失败，请忽略图片相关内容)"
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
    prompt = data.get('prompt', '')
    cid = data.get('cid', '')
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

    conversations[cid].append({"role": "user", "content": prompt})

    try:
        result_dict = get_gpt_response(conversations[cid])
        answer = result_dict.get("answer", "")
        has_image = result_dict.get("has_image", False)
        image_url = result_dict.get("image_url", "")

        conversations[cid].append({"role": "assistant", "content": json.dumps(result_dict)})
        conversations[cid].append({"role": "system", "content": json_prompt})
        conversations[cid].append({"role": "system", "content": simple_system_prompt})

        return jsonify({
            'response': answer,
            'cid': cid,
            'has_image': has_image,
            'image_url': image_url
        })
    except Exception as e:
        print(f'Error occurred: {e}')
        return jsonify({'error': str(e), 'cid': cid}), 500

if __name__ == '__main__':
    print("running")
    app.run(host='0.0.0.0', port=7799, debug=False)
