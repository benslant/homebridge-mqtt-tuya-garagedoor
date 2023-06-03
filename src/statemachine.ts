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
  triggerDoor()
  test()
  door_up()
  door_down()
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
              actions: [this.garageDoor.test.bind(this.garageDoor)]
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
            HOMEKIT_REQUESTS_DOOR_OPEN:
            {
              target: 'wait_for_open',
              actions: [this.garageDoor.door_up.bind(this.garageDoor)]
            },
            DOOR_TRIGGERED: {
              target: 'wait_for_open',
              actions: []
            },
            DOOR_OPEN_DETECTED: {
              target: 'open',
              actions: []
            }
          },
          enter: this.garageDoor.handleDoorClosed.bind(this.garageDoor)
        },
        open: {
          on: {
            HOMEKIT_REQUESTS_DOOR_CLOSE:
            {
              target: 'wait_for_closed',
              actions: [this.garageDoor.door_down.bind(this.garageDoor)]
            },
            DOOR_TRIGGERED: {
              target: 'wait_for_closed',
              actions: []
            },
            DOOR_CLOSE_DETECTED: {
              target: 'closed',
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
            HOMEKIT_REQUESTS_DOOR_OPEN:
            {
              target: 'stopped_waiting_for_close',
              actions: [this.garageDoor.triggerDoor.bind(this.garageDoor)]
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
            HOMEKIT_REQUESTS_DOOR_CLOSE:
            {
              target: 'stopped_waiting_for_open',
              actions: [this.garageDoor.triggerDoor.bind(this.garageDoor)]
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
            HOMEKIT_REQUESTS_DOOR_CLOSE: {
              target: 'wait_for_closed',
              actions: [this.garageDoor.door_down.bind(this.garageDoor)]
            },
            HOMEKIT_REQUESTS_DOOR_OPEN: {
              target: 'wait_for_open',
              actions: [this.garageDoor.door_up.bind(this.garageDoor)]
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
            HOMEKIT_REQUESTS_DOOR_OPEN: {
              target: 'wait_for_open',
              actions: [this.garageDoor.door_up.bind(this.garageDoor)]
            }
          },
          enter: this.garageDoor.handleDoorStopped.bind(this.garageDoor)
        },
        stopped_waiting_for_open: {
          on: {
            DOOR_TRIGGERED: {
              target: 'wait_for_closed',
              actions: []
            },
            HOMEKIT_REQUESTS_DOOR_CLOSE: {
              target: 'wait_for_close',
              actions: [this.garageDoor.door_down.bind(this.garageDoor)]
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
    
      if(event_handler.actions)
      {
        event_handler.actions.forEach(action => {
          action()
        });
      }

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