package docker

import "context"

func listAndConvert[T any, R any](ctx context.Context, listFn func(context.Context) ([]T, error), convertFn func(T) R) ([]R, error) {
	items, err := listFn(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]R, 0, len(items))
	for _, item := range items {
		result = append(result, convertFn(item))
	}

	return result, nil
}
