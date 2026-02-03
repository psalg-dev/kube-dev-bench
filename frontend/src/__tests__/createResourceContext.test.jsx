import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { createResourceContext, createResourceReducer, ActionTypes } from '../state/createResourceContext.jsx';

describe('createResourceReducer', () => {
  it('handles standard loading action', () => {
    const reducer = createResourceReducer();
    const state = reducer({ loading: false }, { type: ActionTypes.SET_LOADING, loading: true });
    expect(state.loading).toBe(true);
  });

  it('handles dynamic SET_* actions', () => {
    const reducer = createResourceReducer();
    const state = reducer({ pods: [] }, { type: 'SET_PODS', data: ['a'] });
    expect(state.pods).toEqual(['a']);
  });

  it('delegates to custom reducers first', () => {
    const reducer = createResourceReducer({
      SET_CUSTOM: (state, action) => ({ ...state, custom: action.value }),
    });
    const state = reducer({ custom: '' }, { type: 'SET_CUSTOM', value: 'ok' });
    expect(state.custom).toBe('ok');
  });
});

describe('createResourceContext', () => {
  it('provides state and refresh handlers', async () => {
    const { Provider, useContext: useTest } = createResourceContext({
      name: 'Test',
      initialState: { loading: false, items: [] },
      refreshFunctions: {
        items: async () => ['a', 'b'],
      },
    });

    let latest;
    function Consumer() {
      latest = useTest();
      return <div>{latest.state.loading ? 'loading' : 'ready'}</div>;
    }

    render(
      <Provider>
        <Consumer />
      </Provider>
    );

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(typeof latest.refreshItems).toBe('function');

    await act(async () => {
      await latest.refreshItems();
    });

    expect(latest.state.items).toEqual(['a', 'b']);
  });
});
