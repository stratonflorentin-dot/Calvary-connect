filepath = r"c:\Users\hp\Downloads\project (1)\firestore.rules"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("'Accountant'", "'ACCOUNTANT'")
content = content.replace("'Operations'", "'OPERATOR'")
content = content.replace("'Mechanic'", "'MECHANIC'")
content = content.replace("'Driver'", "'DRIVER'")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated firestore.rules successfully")
