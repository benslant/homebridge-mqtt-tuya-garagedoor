//https://xstate.js.org/viz/
//Machine({})
//https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h
import {Logger} from 'homebridge'


interface IGarageDoor {
  testEnter()
  startTimerForDoorClose()
  stopTimerForDoorClose()
}


export class TuyaGarageDoorStateMachine {
  garageDoor: IGarageDoor
  log: Logger

  constructor(garageDoor: IGarageDoor,
             log: Logger)
  {
    this.garageDoor = garageDoor
    this.log = log
  }

  getMachine()
  {
    return {
      initial: 'waiting_for_door_state',
      states: {
        waiting_for_door_state: {
          on: {
            DOOR_OPEN_DETECTED: {
              target: 'open',
              actions: [
                { type: 'saveData', }
              ]
            },
            DOOR_CLOSED_DETECTED: {
              target: 'closed',
              actions: []
            }
          },
          exit: this.garageDoor.testEnter.bind(this.garageDoor),
        },
        opening: {
          on: {
            DATA_RECEIVED: {
              target: 'success',
              actions: [
                { type: 'saveData' }
              ]
            }
          }
        },
        closing: {
          on: {
            DATA_RECEIVED: {
              target: 'success',
              actions: [
                { type: 'saveData' }
              ]
            }
          }
        },
        closed: {
          on: {
            DATA_RECEIVED: {
              target: 'success',
              actions: [
                { type: 'saveData' }
              ]
            }
          }
        },
        open: {
          on: {
            DOOR_CLOSING: {
              target: 'wait_for_closed',
              actions: []
            }
          }
        },
        wait_for_closed: {
          on: {
            DOOR_CLOSED: {
              target: 'closed',
              actions: []
            },
            DOOR_CLOSE_TIMEOUT: {
              target: 'stuck',
              actions: []
            },
            DOOR_STOPPED: {
              target: 'stopped',
              actions: []
            },
            DOOR_OPENING: {
              target: 'stopped',
              actions: []
            },
            enter: this.garageDoor.startTimerForDoorClose.bind(this.garageDoor)
          }
        },
        wait_for_open: {
          on: {
            DOOR_OPEN: {
              target: 'open',
              actions: []
            },
            DOOR_OPEN_TIMEOUT: {
              target: 'stuck',
              actions: []
            },
            DOOR_STOPPED: {
              target: 'stopped',
              actions: []
            },
            DOOR_CLOSING: {
              target: 'stopped',
              actions: []
            },
            enter: this.garageDoor.startTimerForDoorClose.bind(this.garageDoor)
          }
        },
        stuck: {
          on: {
            DATA_RECEIVED: {
              target: 'success',
              actions: []
            }
          }
        },
        stopped: {
          on: {
            DOOR_CLOSING: {
              target: 'wait_for_closed',
              actions: []
            },
            DOOR_OPENING: {
              target: 'wait_for_open',
              actions: []
            }
          }
        },
        error: {
          on: {
            DATA_RECEIVED: {
              target: 'success',
              actions:[]
            }
          }
        },
      }
    };
  }

  getInitialState()
  {
    let machine = this.getMachine()
    return {status: machine.initial}
  }
    
  transition(state, event) 
  {
      let machine = this.getMachine()
      const currentStateNode = machine.states[state.status]
      const nextStateNode = machine
        .states[state.status]
        .on?.[event.type]
        ?? { target: state.status }
    
      const nextState = {
        ...state,
        status: nextStateNode.target
      };
    
      // go through the actions to determine
      // what should be done
      nextStateNode.actions?.forEach(action => {
        if (action.type === 'saveData') {
          nextState.data = event.data
        }
      });

      if(currentStateNode.exit) currentStateNode.exit()
      if(nextStateNode.exit) nextStateNode.enter()
    
      if(nextState.status != state.status) this.log.debug(`Leaving ${state.status}... entering ${nextState.status}`)
      return nextState
    }
}