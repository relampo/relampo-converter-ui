# JMX conversion checks

These checks use the public conversion function with the browser's real
`DOMParser`. They need no new dependencies.

From the repository root, run:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/tests/jmx.html` in a browser. All results must have
`passed: true`. The result array is also available as `window.testResults` for
an automated browser runner.

The checks cover error actions, CSV scope and order, nested requests, disabled
elements, and unsupported global stop actions. Conversion warnings explain
load, iteration, sharing, and CSV exhaustion differences that require review.
