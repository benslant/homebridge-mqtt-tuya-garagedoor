//https://xstate.js.org/viz/
//Machine({})
//https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h
import {Logger} from 'homebridge'


export interface IGarageDoor {
  handleInitStateDetected()
  handleDoorClosing()
  handleDoorOpening()
  handleDoorStuck()
  handleDoorFreed()
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
              actions: []
            },
            DOOR_CLOSE_DETECTED: {
              target: 'closed',
              actions: []
            }
          },
          exit: this.garageDoor.handleInitStateDetected.bind(this.garageDoor)
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
            DOOR_TRIGGERED: {
              target: 'wait_for_open',
              actions: []
            }
          },
          enter: this.garageDoor.handleDoorClosed.bind(this.garageDoor)
        },
        open: {
          on: {
            DOOR_TRIGGERED: {
              target: 'wait_for_closed',
              actions: []
            }
          },
          enter: this.garageDoor.handleDoorOpened.bind(this.garageDoor)
        },
        wait_for_closed: {
          on: {
            DOOR_CLOSE_DETECTED: {
              target: 'closed',
              actions: []
            },
            DOOR_CLOSE_TIMEOUT: {
              target: 'stuck',
              actions: []
            },
            DOOR_TRIGGERED: {
              target: 'stopped_waiting_for_close',
              actions: []
            },
          },
          enter: this.garageDoor.handleDoorClosing.bind(this.garageDoor)
        },
        wait_for_open: {
          on: {
            DOOR_OPEN_DETECTED: {
              target: 'open',
              actions: []
            },
            DOOR_OPEN_TIMEOUT: {
              target: 'stuck',
              actions: []
            },
            DOOR_TRIGGERED: {
              target: 'stopped_waiting_for_open',
              actions: []
            },
          },
          enter: this.garageDoor.handleDoorOpening.bind(this.garageDoor)
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
          enter: this.garageDoor.handleDoorStuck.bind(this.garageDoor),
          exit: this.garageDoor.handleDoorFreed.bind(this.garageDoor)
        },
        stopped_waiting_for_close: {
          on: {
            DOOR_TRIGGERED: {
              target: 'wait_for_open',
              actions: []
            },
          },
          enter: this.garageDoor.handleDoorStopped.bind(this.garageDoor)
        },
        stopped_waiting_for_open: {
          on: {
            DOOR_TRIGGERED: {
              target: 'wait_for_closed',
              actions: []
            },
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