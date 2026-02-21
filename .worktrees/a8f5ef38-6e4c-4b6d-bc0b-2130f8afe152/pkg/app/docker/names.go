package docker

import "strings"

const swarmObjectNameMaxLen = 64

func isAlphaNumASCII(r byte) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
}

// swarmTimestampedName builds a Docker Swarm object name (config/secret) that:
// - stays within Docker's 64 character limit
// - uses only allowed characters [a-zA-Z0-9-_.]
// - starts and ends with an alphanumeric character
//
// The caller is expected to provide a stamp that contains only allowed chars.
func swarmTimestampedName(baseName, stamp string) string {
	suffix := "_" + stamp

	maxBase := swarmObjectNameMaxLen - len(suffix)
	b := baseName
	if maxBase < 1 {
		b = "obj"
		maxBase = swarmObjectNameMaxLen - len(suffix)
	}
	if len(b) > maxBase {
		b = b[:maxBase]
	}

	// Trim any trailing non-alphanumeric (e.g. '-' '_' '.') that could be introduced by truncation.
	b = strings.TrimRightFunc(b, func(r rune) bool {
		if r > 127 {
			return true
		}
		return !isAlphaNumASCII(byte(r))
	})
	b = strings.TrimLeftFunc(b, func(r rune) bool {
		if r > 127 {
			return true
		}
		return !isAlphaNumASCII(byte(r))
	})

	if b == "" {
		b = "obj"
	}

	name := b + suffix
	if len(name) > swarmObjectNameMaxLen {
		name = name[:swarmObjectNameMaxLen]
		name = strings.TrimRightFunc(name, func(r rune) bool {
			if r > 127 {
				return true
			}
			return !isAlphaNumASCII(byte(r))
		})
	}
	if name == "" {
		return "obj_" + stamp
	}
	return name
}
