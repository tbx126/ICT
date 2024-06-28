from flask import Flask, request, jsonify, send_file
import re
import json
import uuid
import requests
from io import BytesIO
from openai import OpenAI

app = Flask(__name__)

# Set up OpenAI client
api_key = "sk-B9aJzkfWO3xjl6FO53AeD7A6D9F64a7e971dB43111E4Cd69"
base_url = "https://api.bltcy.ai/v1"

# Print API key and URL for debugging (注意：生产环境不要打印API密钥)
print(f'Using API key {api_key}')
print(f'Using Base URL {base_url}')

client = OpenAI(
    api_key=api_key,
    base_url=base_url
)

# JSON string as system prompt
system_prompt = '''
You discription is Facilitates Alzheimer's assessment in Chinese, includes drawing a clock test. And instruction is This GPT, named Alzheimer VisitaAid, is designed to facilitate a comprehensive preliminary evaluation of Alzheimer's disease by incorporating various scales such as the MOCA (Montreal Cognitive Assessment), ADAS-Cog (Alzheimer's Disease Assessment Scale-Cognitive Subscale), and the Mini-Mental State Examination (MMSE), communicating solely in Chinese. It introduces and explains the sections of these scales one by one, asking questions strictly one at a time to ensure clarity and precision in assessment. It conducts the Clock Drawing Test in every test session, asking users to draw a clock showing a specific time and upload their drawing for evaluation, which helps assess spatial and executive functions as well as memory recall. And it contains Classifaction Test in every test session, you will generate a image which has one daily object or shape on this image and ask user to tell what are they. Remember do not show image generate code. After completing all tests, it generates a comprehensive report analyzing the user's performance, offering preliminary suggestions based on their performance, and estimating the likelihood of having Alzheimer's disease based on their responses. It emphasizes that this evaluation is not a substitute for professional medical advice and strongly recommends consultation with healthcare professionals for a comprehensive diagnosis. It approaches interactions with sensitivity, offering explanations in an accessible manner for non-medical users in Chinese, and provides guidance on subsequent steps if Alzheimer's disease is suspected. Equipped with capabilities for generating images when questions involve visual elements and browsing the internet for up-to-date information on Alzheimer's and cognitive health, it maintains a refined interaction protocol, focusing on a precise and patient-centric assessment process. In communication, it avoids mentioning specific model names or technologies directly, and it does not require users to upload drawings for assessment, ensuring a user-friendly and inclusive approach. It now explicitly includes the delivery of a detailed report at the end of the assessment, outlining the test results, preliminary suggestions, and the estimated probability of Alzheimer's disease, presented in a format that is easy to understand for users. You will be AlzheimerVisitaAID helper. User say begin test and you will test the user. 开始测试
'''
json_prompt = '''
Your response have to follow this format:
    {
    "answer": "",
    "has_image": true or false,
    "image_description": "",
    }
    YOUR REPLY MUST BE DIRECTLY PARSABLE AS JSON!
    YOUR REPLY MUST BE DIRECTLY PARSABLE AS JSON!
    YOUR REPLY MUST BE DIRECTLY PARSABLE AS JSON!
'''

assistant_prompt = "你好!欢迎使用 AlzheimerVisitaAid 测试。这个测试会帮助您进行初步的阿尔茨海默病评估。但请注意，这不是用来替代专业医疗建议的工具，我们强烈建议与医疗专业人士咨询获得全面的诊断。在任何时候都可以说出“开始测试”，开始您的阿尔茨海默病初步评估。"

# Dictionary to store conversation contexts
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
        image_url = response.data[0].url
        return image_url
    except Exception as e:
        print(f'Error generating image: {e}')
        return None


def get_gpt_response(messages, max_retries=5):
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model='gpt-4o',  # Choose an appropriate model
                messages=messages,
                max_tokens=500
            )
            result = response.choices[0].message.content.strip()
            print("--------------------------------------------------------------")

            # 使用正则表达式提取 JSON 字符串
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                result_dict = json.loads(json_str)
                return result_dict
            else:
                print(f"No JSON found in response. Attempt {attempt + 1} of {max_retries}")

        except json.JSONDecodeError:
            print(f"Received non-JSON response. Attempt {attempt + 1} of {max_retries}")

        if attempt < max_retries - 1:
            messages.append({"role": "system", "content": assistant_prompt})
        else:
            print("Failed to get JSON response after maximum retries.")
            raise


@app.route('/create', methods=['POST'])
def create_conversation():
    data = request.json
    prompt = data.get('prompt', '')
    cid = data.get('cid', str(uuid.uuid4()))

    if cid not in conversations:
        conversations[cid] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json_prompt},
            {"role": "assistant", "content": assistant_prompt}
        ]

    conversations[cid].append({"role": "user", "content": prompt})

    try:
        print(f'Received prompt {prompt} for conversation {cid}')
        result_dict = get_gpt_response(conversations[cid])

        print(f"Complete GPT response: {json.dumps(result_dict, ensure_ascii=False, indent=2)}")

        answer = result_dict.get("answer", "")
        has_image = result_dict.get("has_image", False)
        image_description = result_dict.get("image_description", "")

        conversations[cid].append({"role": "assistant", "content": json.dumps(result_dict)})
        conversations[cid].append({"role": "system", "content": json_prompt})

        response_data = {
            'response': answer,
            'cid': cid,
            'has_image': has_image,
            'image_description': image_description
        }

        return jsonify(response_data)
    except Exception as e:
        print(f'Error occurred {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/generate_image', methods=['POST'])
def generate_image_endpoint():
    data = request.json
    cid = data.get('cid')
    image_description = data.get('image_description')

    try:
        image_url = generate_image(image_description)
        if image_url:
            return jsonify({'image_url': image_url})
        else:
            return jsonify({'error': 'Failed to generate image'}), 500
    except Exception as e:
        print(f'Error occurred {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/image/<path:image_url>')
def serve_image(image_url):
    try:
        response = requests.get(image_url)
        return send_file(
            BytesIO(response.content),
            mimetype='image/png'
        )
    except Exception as e:
        print(f'Error serving image: {e}')
        return jsonify({'error': 'Failed to serve image'}), 500


if __name__ == '__main__':
    print(api_key)
    app.run(host='0.0.0.0', port=7799, debug=False)
