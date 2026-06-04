# Container image for the graph-ingest Lambda.
# AWS's Python base image already bundles the Lambda runtime; we just add deps.
FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ${LAMBDA_TASK_ROOT}/

# <module>.<function> — lambda_handler.py :: handler()
CMD ["lambda_handler.handler"]
