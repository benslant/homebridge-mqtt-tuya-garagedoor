//https://xstate.js.org/viz/
//Machine({})
//https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h
import {Logger} from 'homebridge'


export interface IGarageDoor {
  testEnter()
  startTimerForDoorClose()
  startTimerForDoorOpen()
  handleDoorStuck()
  handleDoorStopped()
  handleDoorClosed()
  handleDoorOpened()
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
            DOOR_OPENING: {
              target: 'wait_for_open',
              actions: []
            }
          },
          enter: this.garageDoor.handleDoorClosed.bind(this.garageDoor)
        },
        open: {
          on: {
            DOOR_CLOSING: {
              target: 'wait_for_closed',
              actions: []
            }
          },
          enter: this.garageDoor.handleDoorOpened.bind(this.garageDoor)
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
          },
          enter: this.garageDoor.startTimerForDoorClose.bind(this.garageDoor)
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
          },
          enter: this.garageDoor.startTimerForDoorOpen.bind(this.garageDoor)
        },
        stuck: {
          on: {
            DOOR_CLOSING: {
              target: 'wait_for_closed',
              actions: []
            },
            DOOR_OPENING: {
              target: 'wait_for_open',
              actions: []
            },
          },
          enter: this.garageDoor.handleDoorStuck.bind(this.garageDoor)
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
          },
          enter: this.garageDoor.handleDoorStopped.bind(this.garageDoor)
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
      if(!currentStateNode)
      {
        this.log.error('no current state found! ', state.status)
      }
      const event_handler = currentStateNode.on?.[event.type] ?? state.status
      const nextStateNode = machine.states[event_handler.target]
    
      if(nextStateNode)
      {
        if(currentStateNode.exit) currentStateNode.exit()
        if(nextStateNode.enter) nextStateNode.enter()
        if(event_handler.target != state.status) this.log.debug(`Leaving ${state.status}... entering ${event_handler.target}`)
        return {status: event_handler.target}
      }
      
      return {status: state.status}
    }
}