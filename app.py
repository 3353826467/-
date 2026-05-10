from flask import Flask, request, jsonify, cors
import json
import os

app = Flask(__name__)
cors.CORS(app)

DB_FILE = "database.json"

# 初始化数据库
def init_db():
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)

# 读取数据
def read_db():
    init_db()
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# 写入数据
def write_db(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 获取所有数据
@app.route("/api/get", methods=["GET"])
def get_data():
    return jsonify(read_db())

# 提交单条数据
@app.route("/api/submit", methods=["POST"])
def submit():
    data = request.get_json()
    all_list = read_db()
    # 去重：同年级+同周+同名 覆盖
    new_list = [
        item for item in all_list
        if not (item["grade"] == data["grade"] and item["week"] == data["week"] and item["name"] == data["name"])
    ]
    new_list.append(data)
    write_db(new_list)
    return jsonify({"code":200,"msg":"提交成功"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)