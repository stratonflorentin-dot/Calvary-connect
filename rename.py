import os
import glob

def find_and_replace():
    src_dir = r"c:\Users\hp\Downloads\project (1)\src"
    files = glob.glob(os.path.join(src_dir, "**", "*.ts*"), recursive=True)
    
    count = 0
    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        if "OPERATIONS" in content:
            new_content = content.replace("OPERATIONS", "OPERATOR")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            count += 1
            print(f"Updated {filepath}")
            
    print(f"Total files updated: {count}")

if __name__ == "__main__":
    find_and_replace()
