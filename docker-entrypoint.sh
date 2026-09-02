#!/bin/sh
# Run gulp task(s), then copy the web build to /output when present.
exitcode=0
if [ $# -eq 0 ]; then
  npm run gulp -- "$@"
  exitcode=$?
else
  for task in "$@"; do
    npm run gulp -- "$task" || exitcode=$?
    [ $exitcode -ne 0 ] && break
  done
fi
if [ -d /output ] && [ -d /app/build ]; then
  cp -r /app/build/. /output
fi
exit $exitcode
