import subprocess
import traceback

res = subprocess.run(
    ["python", "-m", "poetry", "run", "python", "test_org.py"],
    capture_output=True,
    text=True
)

print("--- STDOUT ---")
print(res.stdout[-2000:])
print("--- STDERR ---")
print(res.stderr[-2000:])
