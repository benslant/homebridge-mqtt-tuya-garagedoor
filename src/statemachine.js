//https://xstate.js.org/viz/
//https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h
const machine = {
    initial: 'initialize',
    states: {
      initialize: {
        on: {
          // event types
          DATA_RECEIVED: {
            target: 'success',
            // represents what "effects" should happen
            // as a result of taking this transition
            actions: [
              { type: 'saveData' }
            ]
          }
        }
      },
      // ...
      success: {
        on: {
          // event types
          DATA_RECEIVED: {
            target: 'success',
            // represents what "effects" should happen
            // as a result of taking this transition
            actions: [
              { type: 'saveData' }
            ]
          }
        }
      },
      opening: {
        on: {
          // event types
          DATA_RECEIVED: {
            target: 'success',
            // represents what "effects" should happen
            // as a result of taking this transition
            actions: [
              { type: 'saveData' }
            ]
          }
        }
      },
      closing: {
        on: {
          // event types
          DATA_RECEIVED: {
            target: 'success',
            // represents what "effects" should happen
            // as a result of taking this transition
            actions: [
              { type: 'saveData' }
            ]
          }
        }
      },
      closed: {
        on: {
          // event types
          DATA_RECEIVED: {
            target: 'success',
            // represents what "effects" should happen
            // as a result of taking this transition
            actions: [
              { type: 'saveData' }
            ]
          }
        }
      },
      open: {
        on: {
          // event types
          DATA_RECEIVED: {
            target: 'success',
            // represents what "effects" should happen
            // as a result of taking this transition
            actions: [
              { type: 'saveData' }
            ]
          }
        }
      },
      stuck: {
        on: {
          // event types
          DATA_RECEIVED: {
            target: 'success',
            // represents what "effects" should happen
            // as a result of taking this transition
            actions: [
              { type: 'saveData' }
            ]
          }
        }
      },
      error: {
        on: {
          // event types
          DATA_RECEIVED: {
            target: 'success',
            // represents what "effects" should happen
            // as a result of taking this transition
            actions: [
              { type: 'saveData' }
            ]
          }
        }
      },
    }
  };
  
  function transition(state, event) {
    const nextStateNode = machine
      .states[state.status]
      .on?.[event.type]
      ?? { target: state.status };
  
    const nextState = {
      ...state,
      status: nextStateNode.target
    };
  
    // go through the actions to determine
    // what should be done
    nextStateNode.actions?.forEach(action => {
      if (action.type === 'saveData') {
        nextState.data = event.data;
      }
    });
  
    return nextState;
  }

  function transition(state, event) {
    const nextStateNode = machine
      .states[state.status]
      .on?.[event.type]
      ?? { target: state.status };
  
    const nextState = {
      ...state,
      status: nextStateNode.target
    };
  
    // go through the actions to determine
    // what should be done
    nextStateNode.actions?.forEach(action => {
      if (action.type === 'saveData') {
        nextState.data = event.data;
      }
    });
  
    return nextState;
  }