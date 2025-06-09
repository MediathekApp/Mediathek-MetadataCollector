#!/bin/bash


# Get the directory where the script is located
SCRIPT_DIR=$(dirname "$0")

# Output file:
output="$SCRIPT_DIR/bundle.js"

# Empty or create the output file
> "$output"

# Function to transform file content by removing 'export' keywords
transform_content() {
  sed -E 's/^[[:space:]]*export[[:space:]]+//; s/[[:space:]]+export[[:space:]]+//g' "$1"
}

# Append config.json
if [ -f "$SCRIPT_DIR/config.json" ]; then
  echo -e "//config-json-start\n(" >> "$output"
  cat "$SCRIPT_DIR/config.json" >> "$output"
  echo -e "\n)\n//config-json-end\n" >> "$output"
else
  echo "⚠️ Warning: config.js not found. Without the configuration, the application will not work properly. You can use 'config.json.example' as a template to create your own config.json file." >&2
fi

# Append all .js files from ./adapters directory inside script directory
for file in "$SCRIPT_DIR"/adapters/*.js; do
  if [ -f "$file" ]; then
    transform_content "$file" >> "$output"
    echo -e "\n" >> "$output"  # add a newline for separation
  fi
done

# Append shared.js
if [ -f "$SCRIPT_DIR/shared.js" ]; then
  transform_content "$SCRIPT_DIR/shared.js" >> "$output"
  echo -e "\n" >> "$output"
else
  echo "Warning: shared.js not found!"
fi

echo "Bundle created successfully at $output"