# -*- coding: utf-8 -*-
"""
MangaLens 腾讯云 OCR 服务 (高精度版)
- 使用 GeneralAccurateOCR 高精度接口
- 支持手写体、模糊字、小字等困难场景
- 识别准确率 99%
- 支持日文、中文、英文等语言
- 集成图片预处理：添加横向文本锚点解决方向判断问题
"""

import os
import sys
import json
import base64
import time
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.ocr.v20181119 import ocr_client, models

# 锚点文本（用于诱导 OCR 方向）
ANCHOR_TEXT = "<この画像は横方向です>"

# 腾讯云凭证
SECRET_ID = "AKIDcMZYIo4B6pKbfUI4e2EyTiicS8bswnPn"
SECRET_KEY = "EDyVFn7F8nIZdU6JLyMXUEl48wVu513v"
REGION = "ap-guangzhou"  # 广州地域

class TencentOCRServicer:
    """腾讯云 OCR 服务封装"""

    def __init__(self, secret_id=None, secret_key=None, region=None):
        self.secret_id = secret_id or SECRET_ID
        self.secret_key = secret_key or SECRET_KEY
        self.region = region or REGION
        self._init_client()

    def _init_client(self):
        """初始化 OCR 客户端"""
        cred = credential.Credential(self.secret_id, self.secret_key)
        httpProfile = HttpProfile()
        httpProfile.endpoint = "ocr.tencentcloudapi.com"

        clientProfile = ClientProfile()
        clientProfile.httpProfile = httpProfile

        self.client = ocr_client.OcrClient(cred, self.region, clientProfile)

    def _preprocess_image(self, image_path=None, image_base64=None):
        """
        图片预处理：添加横向文本锚点诱导 OCR 方向
        
        Returns:
            dict: {"success": bool, "image_base64": str, "error": str or None}
        """
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # 加载图片
            if image_path:
                img = Image.open(image_path)
            elif image_base64:
                img_data = base64.b64decode(image_base64)
                img = Image.open(io.BytesIO(img_data))
            else:
                return {"success": False, "error": "必须提供 image_path 或 image_base64"}
            
            # 获取图片尺寸
            width, height = img.size
            
            # 字体大小（根据图片宽度调整）
            font_size = max(20, int(width / 40))
            text_height = int(font_size * 2)
            
            # 创建新图片（增加底部空间）
            new_height = height + text_height + 20
            new_img = Image.new('RGB', (width, new_height), (255, 255, 255))
            
            # 粘贴原图
            new_img.paste(img, (0, 0))
            
            # 绘制文本
            draw = ImageDraw.Draw(new_img)
            
            # 尝试加载字体
            try:
                font = ImageFont.truetype("msyh.ttc", font_size)
            except:
                try:
                    font = ImageFont.truetype("/System/Library/Fonts/Hiragino Sans GB.ttc", font_size)
                except:
                    font = ImageFont.load_default()
            
            # 计算文本位置（底部居中）
            bbox = draw.textbbox((0, 0), ANCHOR_TEXT, font=font)
            text_width = bbox[2] - bbox[0]
            text_x = (width - text_width) // 2
            text_y = height + 10
            
            # 绘制白色背景矩形
            bg_padding = 5
            draw.rectangle(
                [text_x - bg_padding, text_y - bg_padding,
                 text_x + text_width + bg_padding, text_y + font_size + bg_padding],
                fill=(255, 255, 255)
            )
            
            # 绘制文本
            draw.text((text_x, text_y), ANCHOR_TEXT, fill=(0, 0, 0), font=font)
            
            # 返回 Base64
            buffer = io.BytesIO()
            new_img.save(buffer, format='PNG')
            return {
                "success": True,
                "image_base64": base64.b64encode(buffer.getvalue()).decode('utf-8'),
                "original_size": (width, height)
            }
            
        except ImportError as e:
            return {"success": False, "error": f"PIL 库未安装: {e}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _filter_anchor_text(self, texts):
        """从 OCR 结果中过滤掉锚点文本"""
        filtered = []
        for item in texts:
            if ANCHOR_TEXT not in item.get("text", ""):
                filtered.append(item)
        return filtered

    def recognize(self, image_path=None, image_base64=None, language="jap", preprocess=True):
        """
        识别图片中的文字（高精度版）

        Args:
            image_path: 本地图片路径（优先使用）
            image_base64: 图片的 Base64 编码
            language: 识别语言，默认日语 (jap)
                     高精度版支持自动检测语言，也可手动指定
            preprocess: 是否预处理图片（添加方向锚点），默认 True

        Returns:
            dict: {
                "success": bool,
                "texts": [
                    {
                        "text": "识别的文字",
                        "confidence": 0.99,
                        "polygon": [{"x": 0, "y": 0}, ...],  # 4个角点
                        "item_polygon": {"x": 0, "y": 0, "width": 100, "height": 20}
                    }, ...
                ],
                "angle": 0.0,  # 图片旋转角度
                "language": "auto",
                "preprocessed": bool,
                "error": None
            }
        """
        try:
            req = models.GeneralAccurateOCRRequest()

            # 预处理图片
            preprocessed_base64 = None
            if preprocess:
                prep_result = self._preprocess_image(image_path=image_path, image_base64=image_base64)
                if prep_result["success"]:
                    preprocessed_base64 = prep_result["image_base64"]
                    print(f"[OCR] 图片已预处理: 原始尺寸 {prep_result.get('original_size')}, 锚点文本: {ANCHOR_TEXT}")
                else:
                    print(f"[OCR] 图片预处理失败: {prep_result.get('error')}, 继续使用原始图片")
            
            # 使用预处理后的图片（或原始图片）
            if preprocessed_base64:
                params = {"ImageBase64": preprocessed_base64}
            elif image_path:
                with open(image_path, "rb") as f:
                    image_data = f.read()
                params = {"ImageBase64": base64.b64encode(image_data).decode("utf-8")}
            elif image_base64:
                params = {"ImageBase64": image_base64}
            else:
                return {"success": False, "error": "必须提供 image_path 或 image_base64"}

            # 高精度版支持多语种识别，设置 ConfigID
            if language:
                params["ConfigID"] = "MulOCR"  # 多语种场景

            req.from_json_string(json.dumps(params))

            # 调用高精度 OCR 接口
            resp = self.client.GeneralAccurateOCR(req)

            # 解析结果
            texts = []
            for detection in resp.TextDetections:
                texts.append({
                    "text": detection.DetectedText,
                    "confidence": detection.Confidence / 100.0 if detection.Confidence else 0.0,
                    "polygon": [
                        {"x": p.X, "y": p.Y}
                        for p in detection.Polygon
                    ] if detection.Polygon else [],
                    "item_polygon": {
                        "x": detection.ItemPolygon.X if detection.ItemPolygon else 0,
                        "y": detection.ItemPolygon.Y if detection.ItemPolygon else 0,
                        "width": detection.ItemPolygon.Width if detection.ItemPolygon else 0,
                        "height": detection.ItemPolygon.Height if detection.ItemPolygon else 0
                    } if detection.ItemPolygon else None
                })

            # 过滤锚点文本
            original_count = len(texts)
            texts = self._filter_anchor_text(texts)
            filtered_count = original_count - len(texts)
            
            if filtered_count > 0:
                print(f"[OCR] 已过滤 {filtered_count} 个锚点文本")

            return {
                "success": True,
                "texts": texts,
                "angle": resp.Angle,
                "language": "auto-detected",
                "preprocessed": preprocessed_base64 is not None,
                "error": None
            }

        except TencentCloudSDKException as e:
            return {"success": False, "error": str(e), "texts": []}
        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {e}", "texts": []}


def ocr_image(image_path, language="jap", preprocess=True):
    """
    便捷函数：识别单张图片

    Args:
        image_path: 图片路径
        language: 语言类型，默认日语
        preprocess: 是否预处理图片，默认 True

    Returns:
        dict: OCR 结果
    """
    service = TencentOCRServicer()
    return service.recognize(image_path=image_path, language=language, preprocess=preprocess)


def ocr_image_base64(image_base64, language="jap", preprocess=True):
    """
    便捷函数：通过 Base64 识别图片

    Args:
        image_base64: Base64 编码的图片
        language: 语言类型，默认日语
        preprocess: 是否预处理图片，默认 True

    Returns:
        dict: OCR 结果
    """
    service = TencentOCRServicer()
    return service.recognize(image_base64=image_base64, language=language, preprocess=preprocess)


# HTTP 服务模式
def run_http_server(host="127.0.0.1", port=8765):
    """启动 HTTP 服务"""
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import urllib.parse

    service = TencentOCRServicer()

    class OCRHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            """处理 OCR 请求"""
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            params = urllib.parse.parse_qs(body)

            # 获取图片数据
            image_path = params.get('image_path', [None])[0]
            image_base64 = params.get('image_base64', [None])[0]
            language = params.get('language', ['jap'])[0]

            # 执行 OCR
            if image_path:
                result = service.recognize(image_path=image_path, language=language)
            elif image_base64:
                result = service.recognize(image_base64=image_base64, language=language)
            else:
                result = {"success": False, "error": "缺少图片参数"}

            # 返回结果
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))

        def log_message(self, format, *args):
            """日志输出"""
            print(f"[OCR Server] {format % args}")

    server = HTTPServer((host, port), OCRHandler)
    print(f"[OCR Server] 启动于 http://{host}:{port}")
    print("[OCR Server] 接收参数: image_path 或 image_base64, language (默认jap)")
    server.serve_forever()


# 测试代码
if __name__ == "__main__":
    import sys

    # 测试模式
    test_image = "C:/Users/31655/Desktop/随时用/004_gbri.jpg"

    if not os.path.exists(test_image):
        print(f"测试图片不存在: {test_image}")
        print("启动 HTTP 服务模式...")
        run_http_server()
    else:
        print("="*60)
        print("腾讯云 OCR 高精度版测试 (GeneralAccurateOCR)")
        print("="*60)

        start = time.time()
        # 高精度版自动检测语言
        result = ocr_image(test_image, language="auto")
        print(f"识别耗时: {time.time()-start:.2f}s")

        if result["success"]:
            print(f"\n识别到 {len(result['texts'])} 个文本区域:")
            print("-"*60)
            for i, item in enumerate(result["texts"]):
                print(f"[{i+1}] {item['text']}")
                if item["item_polygon"]:
                    p = item["item_polygon"]
                    print(f"    位置: ({p['x']}, {p['y']}) {p['width']}x{p['height']}")
                print(f"    置信度: {item['confidence']:.2%}")
                print()
        else:
            print(f"识别失败: {result['error']}")
