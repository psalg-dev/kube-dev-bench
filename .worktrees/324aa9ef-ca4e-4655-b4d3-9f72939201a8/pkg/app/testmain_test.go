package app

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	disableWailsEvents = true
	os.Exit(m.Run())
}
