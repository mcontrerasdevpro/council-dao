#!/usr/bin/env sh
# Regenerate the IPFS single-file build: root index.html with ethers inlined.
# Root index.html is the source of truth; ipfs/index.html is a build artifact.
set -e
awk '/<script src="ethers\.min\.js"><\/script>/{
      print "<script>";
      while ((getline line < "ethers.min.js") > 0) print line;
      print "</script>";
      next
    } { print }' index.html > ipfs/index.html
echo "ipfs/index.html regenerado ($(wc -c < ipfs/index.html) bytes)"
