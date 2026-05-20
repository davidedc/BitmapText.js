# scripts/common.sh — shared helpers sourced by other scripts/*.sh files.
#
# Provides:
#   $PROJECT_ROOT             repo root, derived from this file's own location
#   $RED / $GREEN / $YELLOW / $BLUE / $NC   ANSI colour codes (NC = reset)
#   log LEVEL MSG             coloured, timestamped logger (INFO/SUCCESS/WARNING/ERROR)
#   verify_files F...         fail-fast existence check for a fixed file list
#
# Usage at the top of a script:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/common.sh"
#
# Sourcing — not executing — is intentional: callers inherit $PROJECT_ROOT and
# the colour/log helpers in their own shell.

# Repo root from this file's location (independent of the caller's invocation
# style — relative path, `./scripts/x.sh`, absolute path, all resolve the same).
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PROJECT_ROOT

# ANSI colours for log output.
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m'  # No Color

# Coloured, timestamped logger. Mirrors the format previously inlined in
# test-pipeline.sh / watch-font-assets.sh: "[YYYY-MM-DD HH:MM:SS] [LEVEL] msg".
#   log INFO "..."     blue
#   log SUCCESS "..."  green
#   log WARNING "..."  yellow
#   log ERROR "..."    red
log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=""
    case "$level" in
        INFO)    color="$BLUE" ;;
        SUCCESS) color="$GREEN" ;;
        WARNING) color="$YELLOW" ;;
        ERROR)   color="$RED" ;;
    esac
    echo -e "[$timestamp] ${color}[$level]${NC} $message"
}

# Fail-fast existence check for a fixed source list. Exits the caller on the
# first missing file (sourced — same shell as caller — so `exit` does the right
# thing). Matches the original verify_files used by build-runtime-bundle.sh.
verify_files() {
    local files=("$@")
    for file in "${files[@]}"; do
        if [[ ! -f "$file" ]]; then
            echo "ERROR: Required source file not found: $file"
            exit 1
        fi
    done
}

# Append a //-banner + cat to an output file.
# Usage: section OUT TITLE FILE [strip_first_line]
section() {
    local out="$1"
    local title="$2"
    local file="$3"
    local strip_first_line="${4:-no}"
    {
        echo "// ============================================================================"
        echo "// $title"
        echo "// ============================================================================"
        echo ""
        if [[ "$strip_first_line" == "yes" ]]; then
            tail -n +2 "$file"
        else
            cat "$file"
        fi
        echo ""
    } >> "$out"
}
