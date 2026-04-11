package contentblocks

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var ErrInvalidBlocks = errors.New("invalid content_blocks_json")

// ValidateArray проверяет массив блоков для courses/lessons (text, video, quiz, ide).
func ValidateArray(raw json.RawMessage) error {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	if !json.Valid(raw) {
		return fmt.Errorf("%w: not valid JSON", ErrInvalidBlocks)
	}
	var blocks []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidBlocks, err)
	}
	for i, b := range blocks {
		t, ok := b["type"]
		if !ok {
			return fmt.Errorf("%w: block %d missing type", ErrInvalidBlocks, i)
		}
		var typ string
		if err := json.Unmarshal(t, &typ); err != nil {
			return fmt.Errorf("%w: block %d type", ErrInvalidBlocks, i)
		}
		typ = strings.ToLower(strings.TrimSpace(typ))
		switch typ {
		case "text":
			if err := needString(b, "text", i); err != nil {
				return err
			}
		case "video":
			if needString(b, "embedUrl", i) != nil && needString(b, "embed_url", i) != nil {
				return fmt.Errorf("%w: block %d video needs embedUrl or embed_url", ErrInvalidBlocks, i)
			}
		case "quiz":
			if err := needString(b, "question", i); err != nil {
				return err
			}
			opts, ok := b["options"]
			if !ok {
				return fmt.Errorf("%w: block %d quiz needs options array", ErrInvalidBlocks, i)
			}
			var arr []json.RawMessage
			if json.Unmarshal(opts, &arr) != nil || len(arr) == 0 {
				return fmt.Errorf("%w: block %d quiz.options must be non-empty array", ErrInvalidBlocks, i)
			}
		case "ide":
			if err := needString(b, "template", i); err != nil {
				return err
			}
		default:
			return fmt.Errorf("%w: block %d unknown type %q", ErrInvalidBlocks, i, typ)
		}
	}
	return nil
}

func needString(b map[string]json.RawMessage, key string, blockIdx int) error {
	raw, ok := b[key]
	if !ok {
		return fmt.Errorf("%w: block %d missing %s", ErrInvalidBlocks, blockIdx, key)
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil || strings.TrimSpace(s) == "" {
		return fmt.Errorf("%w: block %d empty %s", ErrInvalidBlocks, blockIdx, key)
	}
	return nil
}
