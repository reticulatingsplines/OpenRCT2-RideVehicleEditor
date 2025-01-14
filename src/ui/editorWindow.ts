import * as Environment from "../environment";
import RideVehicle from "../objects/rideVehicle";
import VehicleEditor, { VehicleSettings } from "../services/editor";
import VehicleSelector from "../services/selector";
import DropdownControl from "../ui/dropdown";
import DropdownSpinnerControl from "../ui/dropdownSpinner";
import SpinnerControl from "../ui/spinner";
import ViewportControl from "../ui/viewport";
import * as ArrayHelper from "../utilities/arrayHelper";
import * as Log from "../utilities/logger";
import ButtonControl, { PressType } from "./button";
import Control, { BindableControl } from "./control";
import DropdownButtonControl from "./dropdownButton";


// Shared coordinate constants
const windowId = "ride-vehicle-editor";
const windowStart = 18;
const windowWidth = 375;
const windowHeight = 285;
const widgetLineHeight = 14;
const groupboxMargin = 5;
const groupboxItemMargin = (groupboxMargin + 5);
const groupboxItemWidth = windowWidth - (groupboxItemMargin * 2);

const editorStartY = 90;
const viewportSize = 100;
const controlsSize = (windowWidth - (groupboxMargin * 2) - (viewportSize + 5));
const controlLabelPart = 0.35; // label takes 35%
const controlHeight = 17;
const buttonSize = 24;


// Records of the last selected ride, train and vehicle, for restoring
// after the window is reopened again.
let lastSelectedRideId: number | null = null;
let lastSelectedTrainIndex: number;
let lastSelectedVehicleIndex: number;


let copiedVehicleSettings: VehicleSettings | null = null;


export default class VehicleEditorWindow
{
	readonly ridesInParkList: DropdownControl;
	readonly trainList: DropdownSpinnerControl;
	readonly vehicleList: DropdownSpinnerControl;

	readonly viewport: ViewportControl;
	readonly rideTypeList: DropdownControl;
	readonly variantSpinner: SpinnerControl;
	readonly trackProgressSpinner: SpinnerControl;
	readonly seatCountSpinner: SpinnerControl;
	readonly powAccelerationSpinner: SpinnerControl;
	readonly powMaxSpeedSpinner: SpinnerControl;
	readonly massSpinner: SpinnerControl;
	readonly soundRangeList: DropdownControl;

	readonly locateButton: ButtonControl;
	readonly pickerButton: ButtonControl;
	readonly copyButton: ButtonControl;
	readonly pasteButton: ButtonControl;
	readonly applyToOthersButton: DropdownButtonControl;
	readonly multiplierDropdown: DropdownControl;


	/**
	 * Event that triggers every frame update of the window.
	 */
	onUpdate?: () => void;


	/**
	 * Event that triggers when the window is closed.
	 */
	onClose?: () => void;


	private _selector: VehicleSelector;
	private _editor: VehicleEditor;

	private _window?: Window;


	/**
	 * Creates a new window for the specified editor.
	 */
	constructor(selector: VehicleSelector, editor: VehicleEditor)
	{
		this._selector = selector;
		this._editor = editor;

		Log.debug("(window) Open window");

		// Rides in park
		this.ridesInParkList = new DropdownControl({
			name: "rve-ride-list",
			tooltip: "List of rides in the park",
			disabledMessage: "No rides in this park",
			disableSingleItem: false,
			x: groupboxItemMargin,
			y: windowStart + 25,
			width: groupboxItemWidth,
			height: widgetLineHeight,
			onSelect: (i): void => selector.selectRide(i)
		});
		selector.ridesInPark.subscribe(r =>
		{
			this.ridesInParkList.params.items =
				(Environment.isDevelopment)
					? r.map(r => `[${r.rideId}] ${r.name}`)
					: r.map(r => r.name);
			this.ridesInParkList.refresh();
		});
		selector.ride.subscribe(() =>
		{
			const index = this._selector.rideIndex;
			if (index !== null)
			{
				this.ridesInParkList.set(index);
			}
			else
			{
				this.ridesInParkList.active(false);
			}
		});

		// Trains on the selected ride
		this.trainList = new DropdownSpinnerControl({
			name: "rve-train-list",
			tooltip: "List of trains on the currently selected ride",
			disabledMessage: "No trains available",
			x: groupboxItemMargin,
			y: windowStart + 43,
			width: (groupboxItemWidth / 2) - 2,
			height: widgetLineHeight,
			onSelect: (i): void => selector.selectTrain(i)
		});
		selector.trainsOnRide.subscribe(t =>
		{
			this.trainList.params.items = t.map(t => `Train ${t.index + 1}`);
			this.trainList.params.maximum = t.length;
			this.trainList.refresh();
		});
		selector.train.subscribe(() =>
		{
			const index = this._selector.trainIndex;
			if (index !== null)
			{
				this.trainList.active(true);
				this.trainList.set(index);
			}
			else
			{
				this.trainList.active(false);
			}
		});

		// Vehicles in the selected train
		this.vehicleList = new DropdownSpinnerControl({
			name: "rve-vehicle-list",
			tooltip: "List of vehicles on the currently selected train",
			disabledMessage: "No vehicles available",
			x: groupboxItemMargin + (groupboxItemWidth / 2) + 2,
			y: windowStart + 43,
			width: (groupboxItemWidth / 2) - 2,
			height: widgetLineHeight,
			onSelect: (i): void => selector.selectVehicle(i)
		});
		selector.vehiclesOnTrain.subscribe(v =>
		{
			this.vehicleList.params.items = v.map((_, i) => `Vehicle ${i + 1}`);
			this.vehicleList.params.maximum = v.length;
			this.vehicleList.refresh();
		});
		selector.vehicle.subscribe(v => this.onSelectVehicle(v));

		// Viewport
		this.viewport = new ViewportControl({
			name: "rve-viewport",
			x: groupboxMargin,
			y: editorStartY,
			width: viewportSize,
			height: viewportSize
		});
		editor.trackProgress.subscribe(() => this.viewport.refresh()); // for when the game is paused

		// Available ride types.
		this.rideTypeList = new DropdownControl({
			name: "rve-ride-type-list",
			tooltip: "All ride types currently available in the park",
			disabledMessage: "No ride types available",
			disableSingleItem: false,
			x: groupboxMargin + viewportSize + 5,
			y: editorStartY,
			width: controlsSize,
			height: widgetLineHeight,
			onSelect: (v): void => editor.setRideType(v)
		});
		editor.rideTypeList.subscribe(rt =>
		{
			this.rideTypeList.params.items =
				(Environment.isDevelopment)
					? rt.map(t => `[${t.id}] ${t.name}`)
					: rt.map(t => t.name);
			this.rideTypeList.refresh();
		});
		editor.rideTypeIndex.subscribe(t =>
		{
			this.rideTypeList.set(t);
			this.variantSpinner.params.maximum = editor.rideType.variantCount;
			this.variantSpinner.refresh();
		});

		// Variant sprite of the selected vehicle.
		this.variantSpinner = new SpinnerControl({
			name: "rve-variant-spinner",
			tooltip: "Sprite variant to use from the selected ride type",
			minimum: 0,
			maximum: 4,
			x: (groupboxMargin + viewportSize + 5) + (controlsSize * controlLabelPart),
			y: (editorStartY + 1 + controlHeight),
			width: (controlsSize * (1 - controlLabelPart)),
			height: widgetLineHeight,
			onChange: (v): void => editor.setVariant(v)
		});
		editor.variant.subscribe(v => this.variantSpinner.set(v));

		// Sets the track progress of the current vehicle
		this.trackProgressSpinner = new SpinnerControl({
			name: "rve-track-progress-spinner",
			tooltip: "Distance in steps of how far the vehicle has progressed along the current track piece",
			wrapMode: "clampThenWrap",
			minimum: -2_147_483_648,
			maximum:  2_147_483_647,
			x: (groupboxMargin + viewportSize + 5) + (controlsSize * controlLabelPart),
			y: (editorStartY + 1 + controlHeight * 2),
			width: (controlsSize * (1 - controlLabelPart)),
			height: widgetLineHeight,
			onChange: (_, i): void => editor.move(i)
		});
		editor.trackProgress.subscribe(v => this.trackProgressSpinner.set(v));

		// Number of seats of the selected vehicle.
		this.seatCountSpinner = new SpinnerControl({
			name: "rve-seats-spinner",
			tooltip: "Total amount of passengers that can cuddle up in this vehicle",
			wrapMode: "clampThenWrap",
			minimum: 0,
			maximum: 33, // vehicles refuse more than 32 guests, leaving them stuck just before entering.
			x: (groupboxMargin + viewportSize + 5) + (controlsSize * controlLabelPart),
			y: (editorStartY + 1 + controlHeight * 3),
			width: (controlsSize * (1 - controlLabelPart)),
			height: widgetLineHeight,
			onChange: (v): void => editor.setSeatCount(v)
		});
		editor.seats.subscribe(v => this.seatCountSpinner.set(v));

		// Total current mass of the selected vehicle.
		this.massSpinner = new SpinnerControl({
			name: "rve-mass-spinner",
			tooltip: "Total amount of mass (weight) of this vehicle, including all its passengers and your mom",
			wrapMode: "clampThenWrap",
			minimum: 0,
			maximum: 65_536,
			x: (groupboxMargin + viewportSize + 5) + (controlsSize * controlLabelPart),
			y: (editorStartY + 1 + controlHeight * 4),
			width: (controlsSize * (1 - controlLabelPart)),
			height: widgetLineHeight,
			onChange: (v): void => editor.setMass(v),
			/* // Does not work yet because the peep array does not refresh properly..
			format: v =>
			{
				const vehicle = this._selector.vehicle.get();
				if (!vehicle)
				{
					return "error: unknown vehicle";
				}
				const peepMass = RideVehicle.massOfPeeps(vehicle.getCar());
				Log.debug(`(window) Format mass; total: ${v}, base: ${v - peepMass}, peeps: ${peepMass}`)
				return `${v - peepMass} (+${peepMass})`;
			}
			*/
		});
		editor.mass.subscribe(v => this.massSpinner.set(v));

		// soundRange ID of the selected vehicle.
		this.soundRangeList = new DropdownControl({
			name: "rve-soundRange-list",
			tooltip: "Pick from available soundRange IDs.",
			disabledMessage: "No soundRange IDs available.",
			items: ["ID 0 - Screams 1 and 8", "ID 1 - Screams 1-7", "ID 2 - Screams 1 and 6", "ID 3 - Whistle", "ID 4 - Bell", "ID 255 - No Sound"],
			disableSingleItem: false,
			x: groupboxMargin + viewportSize + 5 + (controlsSize * controlLabelPart),
			y: (editorStartY + 1 + controlHeight * 5),
			width: (controlsSize * (1 - controlLabelPart)),
			height: widgetLineHeight,
			onSelect: (v): void => editor.setSoundrange(v),
		});
		editor.soundRange.subscribe(v =>
			{
			if (v == 255)
			{
				v = 6;
			}
			this.soundRangeList.set(v);
		}
			);

		// Powered acceleration of the selected vehicle.
		this.powAccelerationSpinner = new SpinnerControl({
			name: "rve-powered-acceleration-spinner",
			tooltip: "Cranks up the engines to accelerate faster, self-powered vehicles only",
			disabledMessage: "Only on powered vehicles",
			wrapMode: "clampThenWrap",
			minimum: 0,
			maximum: 256,
			x: (groupboxMargin + viewportSize + 5) + (controlsSize * controlLabelPart),
			y: (editorStartY + 1 + controlHeight * 6),
			width: (controlsSize * (1 - controlLabelPart)),
			height: widgetLineHeight,
			onChange: (v): void => editor.setPoweredAcceleration(v)
		});
		editor.poweredAcceleration.subscribe(v => this.powAccelerationSpinner.set(v));

		// Powered maximum speed of the selected vehicle.
		this.powMaxSpeedSpinner = new SpinnerControl({
			name: "rve-powered-max-speed-spinner",
			tooltip: "The (il)legal speed limit for your vehicle, self-powered vehicles only",
			disabledMessage: "Only on powered vehicles",
			wrapMode: "clampThenWrap",
			minimum: 0,
			maximum: 256,
			x: (groupboxMargin + viewportSize + 5) + (controlsSize * controlLabelPart),
			y: (editorStartY + 1 + controlHeight * 7),
			width: (controlsSize * (1 - controlLabelPart)),
			height: widgetLineHeight,
			onChange: (v): void => editor.setPoweredMaximumSpeed(v)
		});
		editor.poweredMaxSpeed.subscribe(v => this.powMaxSpeedSpinner.set(v));

		// Enable/disable the powered spinners if the vehicle is powered.
		editor.isPowered.subscribe(v =>
		{
			this.powAccelerationSpinner.active(v);
			this.powMaxSpeedSpinner.active(v);
		});

		// Button to locate the vehicle in the main viewport.
		this.locateButton = new ButtonControl({
			name: "rve-locate-button",
			tooltip: "Locate your vehicle when you've lost it (again)",
			image: 5167, // SPR_LOCATE
			x: (groupboxMargin + 1),
			y: (editorStartY + viewportSize + 8),
			width: buttonSize,
			height: buttonSize,
			onClick: (): void => this._editor.locate()
		});

		this.pickerButton = new ButtonControl({
			name: "rve-picker-button",
			tooltip: "Use the picker to select a vehicle by clicking it",
			image: 29467, // SPR_G2_EYEDROPPER
			mode: "toggle",
			x: (groupboxMargin + buttonSize + 2),
			y: (editorStartY + viewportSize + 8),
			width: buttonSize,
			height: buttonSize,
			onClick: (type: PressType): void => this.pickVehicle(type)
		});

		this.copyButton = new ButtonControl({
			name: "rve-copy-button",
			tooltip: "Copies the current vehicle settings to your clipboard",
			mode: "toggle",
			image: 29434, // SPR_G2_COPY
			isPressed: (copiedVehicleSettings !== null),
			x: (groupboxMargin + (buttonSize + 1) * 2) + 1,
			y: (editorStartY + viewportSize + 8),
			width: buttonSize,
			height: buttonSize,
			onClick: (type: PressType): void => this.onClickCopy(type)
		});

		this.pasteButton = new ButtonControl({
			name: "rve-paste-button",
			tooltip: "Pastes the previously copied vehicle settings over the currently selected vehicle",
			isActive: (copiedVehicleSettings !== null),
			image: 29435, // SPR_G2_PASTE
			x: (groupboxMargin + (buttonSize + 1) * 3) + 1,
			y: (editorStartY + viewportSize + 8),
			width: buttonSize,
			height: buttonSize,
			onClick: (): void =>
			{
				if (copiedVehicleSettings !== null)
				{
					Log.debug(`(window) Paste settings: ${JSON.stringify(copiedVehicleSettings)}`);
					this._editor.applySettings(copiedVehicleSettings);
				}
			}
		});

		// Dropdown button to apply current settings to other vehicles.
		this.applyToOthersButton = new DropdownButtonControl({
			name: "rve-apply-to-others-button",
			tooltip: "Apply the current vehicle settings to a specific set of other vehicles on this ride",
			buttons: [
				{ text: "Apply this to all vehicles", onClick: (): void => this.applyToAllVehicles() },
				{ text: "Apply this to preceding vehicles", onClick: (): void => this.applyToPrecedingVehicles() },
				{ text: "Apply this to following vehicles", onClick: (): void => 	this.applyToFollowingVehicles() },
				{ text: "Apply this to all trains", onClick: (): void => this.applyToAllTrains() }
			],
			x: (groupboxMargin + viewportSize + 5),
			y: (editorStartY + controlHeight * 8) + 2,
			width: 211,
			height: (widgetLineHeight + 1),
		});

		// Dropdown to multiply the spinner increments.
		this.multiplierDropdown = new DropdownControl({
			name: "rve-multiplier-dropdown",
			tooltip: "Multiplies all spinner controls by the specified amount",
			items: ["x1", "x10", "x100"],
			x: (windowWidth - (groupboxMargin + 45)),
			y: (editorStartY + controlHeight * 8) + 2,
			width: 45,
			height: widgetLineHeight,
			onSelect: (i): void => this.updateMultiplier(i)
		});
	}


	/**
	 * Creates a new editor window.
	 */
	private createWindow(): Window
	{
		let windowTitle = `Ride vehicle editor (v${Environment.pluginVersion})`;

		if (Environment.isDevelopment)
		{
			windowTitle += " [DEBUG]";
		}

		const window = ui.openWindow({
			classification: windowId,
			title: windowTitle,
			width: windowWidth,
			height: windowHeight,
			widgets: [
				// Selection group
				<Widget>{
					type: "groupbox",
					x: groupboxMargin,
					y: windowStart,
					width: windowWidth - (groupboxMargin * 2),
					height: 64
				},

				// Ride selector
				<LabelWidget>{
					type: "label",
					x: groupboxItemMargin,
					y: windowStart + 10,
					width: groupboxItemWidth,
					height: widgetLineHeight,
					text: "Pick a ride:"
				},
				this.ridesInParkList.createWidget(),

				// Train & vehicle selectors
				...this.trainList.createWidgets(),
				...this.vehicleList.createWidgets(),

				// Ride vehicle editor:
				this.viewport.createWidget(),
				this.rideTypeList.createWidget(),

				// Vehicle variant
				<LabelWidget>{
					tooltip: this.variantSpinner.params.tooltip,
					type: "label",
					x: (groupboxMargin + viewportSize + 5),
					y: (editorStartY + controlHeight) + 2,
					width: (controlsSize * controlLabelPart),
					height: widgetLineHeight,
					text: "Variant:"
				},
				this.variantSpinner.createWidget(),

				// Track progress
				<LabelWidget>{
					tooltip: this.trackProgressSpinner.params.tooltip,
					type: "label",
					x: (groupboxMargin + viewportSize + 5),
					y: (editorStartY + controlHeight * 2) + 2,
					width: (controlsSize * controlLabelPart),
					height: widgetLineHeight,
					text: "Track progress:"
				},
				this.trackProgressSpinner.createWidget(),

				// Number of seats
				<LabelWidget>{
					tooltip: this.seatCountSpinner.params.tooltip,
					type: "label",
					x: (groupboxMargin + viewportSize + 5),
					y: (editorStartY + controlHeight * 3) + 2,
					width: (controlsSize * controlLabelPart),
					height: widgetLineHeight,
					text: "Seats:"
				},
				this.seatCountSpinner.createWidget(),

				// Mass
				<LabelWidget>{
					tooltip: this.massSpinner.params.tooltip,
					type: "label",
					x: (groupboxMargin + viewportSize + 5),
					y: (editorStartY + controlHeight * 4) + 2,
					width: (controlsSize * controlLabelPart),
					height: widgetLineHeight,
					text: "Mass:"
				},
				this.massSpinner.createWidget(),

				// soundRange
				<LabelWidget>{
					tooltip: this.soundRangeList.params.tooltip,
					type: "label",
					x: (groupboxMargin + viewportSize + 5),
					y: (editorStartY + controlHeight * 5) + 2,
					width: (controlsSize * controlLabelPart),
					height: widgetLineHeight,
					text: "soundRange:"
				},
				this.soundRangeList.createWidget(),

				// Powered acceleration
				<LabelWidget>{
					tooltip: this.powAccelerationSpinner.params.tooltip,
					type: "label",
					x: (groupboxMargin + viewportSize + 5),
					y: (editorStartY + controlHeight * 6) + 2,
					width: (controlsSize * controlLabelPart),
					height: widgetLineHeight,
					text: "Acceleration:"
				},
				this.powAccelerationSpinner.createWidget(),

				// Powered maximum speed
				<LabelWidget>{
					tooltip: this.powMaxSpeedSpinner.params.tooltip,
					type: "label",
					x: (groupboxMargin + viewportSize + 5),
					y: (editorStartY + controlHeight * 7) + 2,
					width: (controlsSize * controlLabelPart),
					height: widgetLineHeight,
					text: "Max. speed:"
				},
				this.powMaxSpeedSpinner.createWidget(),

				// Toolbar
				this.locateButton.createWidget(),
				this.pickerButton.createWidget(),
				this.copyButton.createWidget(),
				this.pasteButton.createWidget(),
				...this.applyToOthersButton.createWidgets(),
				this.multiplierDropdown.createWidget(),

				<LabelWidget>{
					tooltip: "Go to this URL to check for the latest updates",
					type: "label",
					x: -1,
					y: (windowHeight - (widgetLineHeight + 3)),
					width: windowWidth,
					height: widgetLineHeight,
					text: "github.com/Basssiiie/OpenRCT2-RideVehicleEditor",
					textAlign: "centred",
					isDisabled: true
				},
			],
			onUpdate: () =>
			{
				if (this.onUpdate)
				{
					this.onUpdate();
				}
			},
			onClose: () =>
			{
				Log.debug("(window) Close window.");
				lastSelectedRideId = this._selector.ride.get()?.rideId ?? null;
				lastSelectedTrainIndex = this._selector.trainIndex ?? 0;
				lastSelectedVehicleIndex = this._selector.vehicleIndex ?? 0;
				this.viewport.stop();

				if (this.onClose)
				{
					this.onClose();
				}
			}
		});

		// Bind all controls to this window...
		for (const field in this)
		{
			const value = this[field];
			if (value instanceof Control)
			{
				(value as BindableControl).bind(window);
			}
		}

		Log.debug("(window) Window creation complete.");
		return window;
	}


	/**
	 * Creates a new vehicle editor, or shows the currently opened one.
	 */
	show(): void
	{
		if (this._window)
		{
			Log.debug("(window) Window is already open.");
			this._window.bringToFront();
		}
		else
		{
			Log.debug("(window) Ride vehicle editor window opened.");
			this._window = this.createWindow();

			this._selector.reloadRideList();
			if (lastSelectedRideId !== -1)
			{
				// Restore last selected ride, train and vehicle.
				const rideIndex = ArrayHelper.findIndex(this._selector.ridesInPark.get(), r => r.rideId === lastSelectedRideId);
				if (rideIndex !== null)
				{
					Log.debug("(window) Restore previous selection succesfull.");
					this._selector.selectRide(rideIndex, lastSelectedTrainIndex, lastSelectedVehicleIndex);
					return;
				}
			}

			// Not found, select first available ride.
			Log.debug("(window) Restore selection failed: ride not found.");
			this._selector.selectRide(0);

			// If none is selectable, ensure controls are disabled..
			if (this._selector.vehicle.get() === null)
			{
				this.onSelectVehicle(null);
			}
		}
	}


	/**
	 * Closes the currently opened window.
	 */
	close(): void
	{
		ui.closeWindows(windowId);
	}


	/**
	 * Event that triggers when a vehicle is selected.
	 * @param vehicle The selected vehicle.
	 */
	private onSelectVehicle(vehicle: RideVehicle | null): void
	{
		// Toggle base controls
		const toggle = (toggle: boolean): void =>
		{
			this.vehicleList.active(toggle);
			this.rideTypeList.active(toggle);
			this.variantSpinner.active(toggle);
			this.trackProgressSpinner.active(toggle);
			this.seatCountSpinner.active(toggle);
			this.massSpinner.active(toggle);
			this.soundRangeList.active(toggle);

			// Buttons
			this.applyToOthersButton.active(toggle);
			this.locateButton.active(toggle);
			this.copyButton.active(toggle);
		};

		if (vehicle !== null)
		{
			const index = this._selector.vehicleIndex;
			if (index !== null)
			{
				Log.debug(`(window) New vehicle index ${index} selected.`);
				toggle(true);
				this.vehicleList.set(index);
				this.viewport.follow(vehicle.entityId);

				// Powered properties only
				const isPowered = vehicle.isPowered();
				this.powAccelerationSpinner.active(isPowered);
				this.powMaxSpeedSpinner.active(isPowered);
				return;
			}
		}

		Log.debug(`(window) Failed to select vehicle, disable controls.`);
		toggle(false);
		this.powAccelerationSpinner.active(false);
		this.powMaxSpeedSpinner.active(false);
		this.viewport.stop();
	}


	/**
	 * Updates the multiplier based on which checkbox was updated.
	 * @param selectedIndex The index of the multiplier option that was selected.
	 */
	private updateMultiplier(selectedIndex: number): void
	{
		const increment = (10 ** selectedIndex);
		Log.debug(`(window) Updated multiplier to ${increment}. (index: ${selectedIndex})`);

		this.setSpinnerIncrement(this.trackProgressSpinner, increment);
		this.setSpinnerIncrement(this.seatCountSpinner, increment);
		this.setSpinnerIncrement(this.powAccelerationSpinner, increment);
		this.setSpinnerIncrement(this.powMaxSpeedSpinner, increment);
		this.setSpinnerIncrement(this.massSpinner, increment);
	}


	/**
	 * Sets the increment of the spinner to the specified amount, and refreshes it.
	 * @param spinner The spinner to update.
	 * @param increment The increment the spinner should use.
	 */
	private setSpinnerIncrement(spinner: SpinnerControl, increment: number): void
	{
		spinner.params.increment = increment;
		spinner.refresh();
	}


	/**
	 * Applies the settings of the currently selected vehicle to all vehicles on the
	 * selected train.
	 */
	private applyToAllVehicles(): void
	{
		const settings = this._editor.getSettings();
		if (settings)
		{
			this._editor.applySettingsToCurrentTrain(settings, 0);
		}
	}


	/**
	 * Applies the settings of the currently selected vehicle to all vehicles after
	 * this vehicle on the selected train.
	 */
	private applyToFollowingVehicles(): void
	{
		const currentVehicleIndex = this._selector.vehicleIndex;
		if (currentVehicleIndex !== null)
		{
			const settings = this._editor.getSettings();
			if (settings)
			{
				this._editor.applySettingsToCurrentTrain(settings, currentVehicleIndex + 1);
			}
		}
	}


	/**
	 * Applies the settings of the currently selected vehicle to all vehicles before
	 * this vehicle on the selected train.
	 */
	private applyToPrecedingVehicles(): void
	{
		const currentVehicleIndex = this._selector.vehicleIndex;
		if (currentVehicleIndex !== null)
		{
			const settings = this._editor.getSettings();
			if (settings)
			{
				this._editor.applySettingsToCurrentTrain(settings, 0, currentVehicleIndex);
			}
		}
	}


	/**
	 * Applies the settings of the currently selected vehicle to all trains and vehicles
	 * on the selected ride.
	 */
	private applyToAllTrains(): void
	{
		const settings = this._editor.getSettings();
		if (settings)
		{
			this._editor.applySettingsToAllTrains(settings);
		}
	}


	/**
	 * Starts a tool that allows the user to click on a vehicle to select it.
	 */
	private pickVehicle(type: PressType): void
	{
		if (type === "up")
		{
			const tool = ui.tool;
			if (tool && tool.id === "rve-pick-vehicle")
			{
				tool.cancel();
			}
		}
		else
		{
			ui.activateTool({
				id: "rve-pick-vehicle",
				cursor: "cross_hair",
				onDown: a =>
				{
					if (a.entityId)
					{
						this._selector.selectEntity(a.entityId);
						ui.tool?.cancel();
					}
				},
				onFinish: () =>
				{
					this.pickerButton.set("up");
				}
			});
		}
	}


	/**
	 * Enables and disables the copy/paste buttons depending on the copy state.
	 */
	private onClickCopy(type: PressType): void
	{
		const isDown = (type === "down");
		if (isDown)
		{
			copiedVehicleSettings = this._editor.getSettings();
			if (copiedVehicleSettings === null)
			{
				this.copyButton.set("up");
			}
		}
		else
		{
			copiedVehicleSettings = null;
		}
		Log.debug(`(window) Copied: ${isDown}`);
		this.pasteButton.active(isDown);
	}


	/**
	 * Resets all window globals for unit tests.
	 */
	static resetGlobals(): void
	{
		lastSelectedRideId = null;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		lastSelectedTrainIndex = lastSelectedVehicleIndex = undefined!;
		copiedVehicleSettings = null;
	}
}
