import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { Characteristic } from 'hap-nodejs';
import { TuyaMqttGarageDoorPlatform } from './platform';
import { Z2MMqttClient } from './mqtt_client';
import { TuyaGarageDoorStateMachine, IGarageDoor } from './statemachine'


export class TuyaMqttGarageDoorAccessory implements IGarageDoor {
  private service: Service;
  private client: Z2MMqttClient;
  private statemachine: TuyaGarageDoorStateMachine;
  private doorOperationTimer: ReturnType<typeof setTimeout>
  private currentState = {
    status: 'initialize'
  }

  private state = {
    targetDoorState: Characteristic.TargetDoorState.CLOSED,
    currentDoorState: Characteristic.CurrentDoorState.CLOSED,
    obstructionDetected: false,
    trigger_state_detected: false,
    last_trigger_state: false
  };

  constructor(private readonly platform: TuyaMqttGarageDoorPlatform,
              private readonly accessory: PlatformAccessory,
              private readonly mqqt_client: Z2MMqttClient) 
  {
    let that = this
    this.doorOperationTimer = setInterval(()=>{
        that.platform.log.error('why!')
    }, 1000)
    clearInterval(this.doorOperationTimer)
    this.statemachine = new TuyaGarageDoorStateMachine(this, this.platform.log)
    this.currentState = this.statemachine.getInitialState()
    this.client = mqqt_client
    this.client.on('garage_door_contact', (open) => {
      this.handle_mqtt_update_current_door_state(open)}
      )
    this.client.on('trigger', (trigger) => {
        this.handle_mqtt_door_trigger(trigger)}
        )
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.GarageDoorOpener) || this.accessory.addService(this.platform.Service.GarageDoorOpener);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    this.service.getCharacteristic(this.platform.Characteristic.TargetDoorState)
      .onSet(this.setTargetDoorState.bind(this))
      .onGet(this.getTargetDoorState.bind(this))

    this.service.getCharacteristic(this.platform.Characteristic.CurrentDoorState)
      .onGet(this.getCurrentDoorState.bind(this))

    this.service.getCharacteristic(this.platform.Characteristic.ObstructionDetected)
      .onGet(this.getObstructionState.bind(this))
    this.broadcastDoorState()
  }

  async setTargetDoorState(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.state.targetDoorState = value as number
    if(value==0) this.platform.log.debug('Set Door Target state -> OPEN');
    if(value==1) this.platform.log.debug('Set Door Target state -> CLOSED');
    let event = 'HOMEKIT_REQUESTS_DOOR_CLOSE'
    if(this.state.targetDoorState == Characteristic.TargetDoorState.OPEN) event = 'HOMEKIT_REQUESTS_DOOR_OPEN'
    this.processDoorState(event)
  }

  processDoorState(event_name: String)
  {
    let event = { type: event_name}
    this.currentState = this.statemachine.transition(this.currentState, event)
  }

  getCurrentDoorStateName(state: number)
  {
    let currentDoorStateName = 'OPEN'
    if(this.state.currentDoorState == 1) currentDoorStateName = 'CLOSED'
    if(this.state.currentDoorState == 2) currentDoorStateName = 'OPENING'
    if(this.state.currentDoorState == 3) currentDoorStateName = 'CLOSING'
    if(this.state.currentDoorState == 4) currentDoorStateName = 'STOPPED'
    return currentDoorStateName
  }

  getTargetDoorStateName(state: number)
  {
    let targetDoorStateName = 'CLOSED'
    if(this.state.targetDoorState == 0) targetDoorStateName = 'OPEN'
    return targetDoorStateName
  }

  async getCurrentDoorState(): Promise<CharacteristicValue> {
    let currentDoorStateName = this.getCurrentDoorStateName(this.state.currentDoorState)
    // implement your own code to check if the device is on
    const currentDoorState = this.state.currentDoorState;
    this.platform.log.debug('HomeKit Requests Current Door State, Returning -> ', currentDoorStateName);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return currentDoorState;
  }

  async getTargetDoorState(): Promise<CharacteristicValue> 
  {
    let targetDoorStateName = this.getTargetDoorStateName(this.state.targetDoorState)
    
    this.platform.log.debug('HomeKit Requests Target Door State, Returning ->', targetDoorStateName);
    if(this.currentState.status == 'waiting_for_door_state')
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return this.state.targetDoorState;
  }

  broadcastDoorState()
  {
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentDoorState,this.state.currentDoorState)
    this.service.updateCharacteristic(this.platform.Characteristic.TargetDoorState,this.state.targetDoorState)
    this.service.updateCharacteristic(this.platform.Characteristic.ObstructionDetected,this.state.obstructionDetected)
    this.platform.log.debug(`Updating Door State: Target: ${this.getTargetDoorStateName(this.state.targetDoorState)} Current: ${this.getCurrentDoorStateName(this.state.currentDoorState)} Obstructed: ${this.state.obstructionDetected}`)
  }

  async getObstructionState(): Promise<CharacteristicValue> {
    this.platform.log.debug('HomeKit Requests Door Obstruction State, Returning ->', this.state.obstructionDetected);
    return this.state.obstructionDetected
  }

  handle_mqtt_door_trigger(trigger: boolean)
  {
    if(this.state.trigger_state_detected)
    {
      if(trigger != this.state.last_trigger_state)
      {
        this.state.last_trigger_state = trigger
        this.processDoorState('DOOR_TRIGGERED')
      }
      else
      {
      this.state.trigger_state_detected = true
      this.state.last_trigger_state = trigger
      }
    }
  }

  handle_mqtt_update_current_door_state(closed: boolean)
  {
    let state_text = 'closed'
    if(!closed) state_text = 'open'  
    if(closed)
    {
      this.state.currentDoorState = Characteristic.CurrentDoorState.CLOSED
      this.processDoorState('DOOR_CLOSE_DETECTED')
    } else
    {
      this.state.currentDoorState = Characteristic.CurrentDoorState.OPEN
      this.processDoorState('DOOR_OPEN_DETECTED')
    }
    this.broadcastDoorState()
  }

  handleInitStateDetected()
  {
    if(this.state.currentDoorState == Characteristic.CurrentDoorState.OPEN)
      this.state.targetDoorState = Characteristic.TargetDoorState.OPEN
    if(this.state.currentDoorState == Characteristic.CurrentDoorState.CLOSED)
      this.state.targetDoorState = Characteristic.TargetDoorState.CLOSED
    this.state.obstructionDetected = false
    this.broadcastDoorState()
  }

  handleDoorOpening()
  {
    this.startTimerForDoorOpen()
  }

  handleDoorClosing()
  {
    this.startTimerForDoorClose()
  }

  triggerDoor()
  {
    this.mqqt_client.publishTopic({trigger: true})
  }

  door_up()
  {
    this.platform.log.debug('Triggering door up')
    this.mqqt_client.publishTopic({trigger: true})
  }

  door_down()
  {
    this.platform.log.debug('Triggering door down')
    this.mqqt_client.publishTopic({trigger: false})
  }

  /// Wait for the door to close. Triggers an event 
  ///
  startTimerForDoorClose()
  {
    this.state.currentDoorState = Characteristic.CurrentDoorState.CLOSING
    this.broadcastDoorState()
    this.doorOperationTimer = setTimeout(this.handleDoorCloseTimeout.bind(this), 20000);
  }

  startTimerForDoorOpen()
  {
    this.state.currentDoorState = Characteristic.CurrentDoorState.OPENING
    this.broadcastDoorState()
    this.doorOperationTimer = setTimeout(this.handleDoorOpenTimeout.bind(this), 20000);
  }

  handleDoorStopped()
  {
    clearTimeout(this.doorOperationTimer)
    this.platform.log.debug('The door was stopped by user!')
    this.state.currentDoorState = Characteristic.CurrentDoorState.STOPPED
    this.broadcastDoorState()
  }

  handleDoorCloseTimeout()
  {
    this.platform.log.error("Door close operation timedout!")
    this.processDoorState('DOOR_CLOSE_TIMEOUT')
  }

  handleDoorOpenTimeout()
  {
    this.platform.log.error("Door open operation timedout!")
    this.processDoorState('DOOR_OPEN_TIMEOUT')
  }

  handleDoorStuck()
  {
    this.platform.log.error("Door is stuck!")
    this.state.obstructionDetected = true
    this.state.currentDoorState = Characteristic.CurrentDoorState.STOPPED
    this.broadcastDoorState()
  }

  handleDoorFreed() 
  {
    this.state.obstructionDetected = false
    this.broadcastDoorState()
  }

  handleDoorOpened()
  {
    clearTimeout(this.doorOperationTimer)
    this.state.currentDoorState = Characteristic.CurrentDoorState.OPEN
    this.broadcastDoorState()
  }

  handleDoorClosed()
  {
    clearTimeout(this.doorOperationTimer)
    this.state.currentDoorState = Characteristic.CurrentDoorState.CLOSED
    this.broadcastDoorState()
  }

  test() {
    this.platform.log.debug('Test handler triggered')
  }
}