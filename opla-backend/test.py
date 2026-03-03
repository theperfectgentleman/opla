import urllib.request
import json
import urllib.error

req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/register/email',
    data=json.dumps({'email': 'test4@opla.ai', 'password': 'Test1234()', 'full_name': 'Test'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    res = urllib.request.urlopen(req)
    print("Success:")
    print(res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error", e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print("Other error:", e)
