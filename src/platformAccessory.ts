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
    obstructionDetected: false
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
    this.platform.log.debug('Set Door Target state ->', this.state.targetDoorState);
    let event = 'DOOR_CLOSING'
    if(this.state.targetDoorState == Characteristic.TargetDoorState.OPEN) event = 'DOOR_OPENING'
    this.processDoorState(event)
  }

  processDoorState(event_name: String)
  {
    let event = { type: event_name}
    this.currentState = this.statemachine.transition(this.currentState, event)
  }

  testEnter()
  {
    this.platform.log.debug('test');
  }

  async getCurrentDoorState(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const currentDoorState = this.state.currentDoorState;
    this.platform.log.debug('Get Door Current State ->', currentDoorState);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return currentDoorState;
  }

  broadcastDoorState()
  {
    this.service.updateCharacteristic(Characteristic.CurrentDoorState,this.state.currentDoorState)
    this.service.updateCharacteristic(Characteristic.TargetDoorState,this.state.targetDoorState)
    this.service.updateCharacteristic(Characteristic.ObstructionDetected,this.state.obstructionDetected)
  }

  async getObstructionState(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Obstruction State ->', this.state.obstructionDetected);
    return this.state.obstructionDetected
  }

  handle_mqtt_update_current_door_state(closed: boolean)
  {
    if(closed)
    {
      this.processDoorState('DOOR_CLOSED_DETECTED')
      this.state.currentDoorState = Characteristic.CurrentDoorState.CLOSED
    } else
    {
      this.processDoorState('DOOR_OPEN_DETECTED')
      this.state.currentDoorState = Characteristic.CurrentDoorState.OPEN
    }
    this.broadcastDoorState()
    let state_text = 'closed'
    if(!closed) state_text = 'open'  
    this.platform.log.debug('Received door state -> ', state_text)
  }

  async getTargetDoorState(): Promise<CharacteristicValue> 
  {
    this.platform.log.debug('Get Target Door State ->', this.state.targetDoorState);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return this.state.targetDoorState;
  }

  handleDoorOpening()
  {
    this.startTimerForDoorOpen()
    this.triggerDoor()
  }

  handleDoorClosing()
  {
    this.startTimerForDoorClose()
    this.triggerDoor()
  }

  triggerDoor()
  {
    this.mqqt_client.publishTopic({trigger: true})
  }

  /// Wait for the door to close. Triggers an event 
  ///
  startTimerForDoorClose()
  {
    this.state.currentDoorState = Characteristic.CurrentDoorState.CLOSING
    this.broadcastDoorState()
    this.doorOperationTimer = setTimeout(this.handleDoorCloseTimeout.bind(this), 5000);
  }

  startTimerForDoorOpen()
  {
    this.state.currentDoorState = Characteristic.CurrentDoorState.OPENING
    this.broadcastDoorState()
    this.doorOperationTimer = setTimeout(this.handleDoorOpenTimeout.bind(this), 5000);
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
    this.service.updateCharacteristic(Characteristic.CurrentDoorState,
                                      Characteristic.CurrentDoorState.OPEN)
  }

  handleDoorClosed()
  {
    clearTimeout(this.doorOperationTimer)
    this.state.currentDoorState = Characteristic.CurrentDoorState.CLOSED
    this.service.updateCharacteristic(Characteristic.CurrentDoorState,
                                      Characteristic.CurrentDoorState.CLOSED)
  }
}