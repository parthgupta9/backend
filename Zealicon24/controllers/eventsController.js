import { startSession } from "mongoose";
import { addRowToSheet, createSpreadsheet, removeRowFromSheet } from "../helpers/sheetsHelper.js";
import eventsModel from "../models/eventsModel.js";
import userModel from "../models/userModel.js";
import { EVENT_TYPES, GSHEET_HEADERS, SOCIETIES } from "../config/appConfig.js";
import { createObject, validateDate } from "../helpers/generalHelpers.js";

export const getEventsController = async (req, res) => {
  try {
    const { _id } = req.user;
    const { society, event_id, event_type } = req.query;

    let events = [];

    if (event_type && ![...EVENT_TYPES, "REGISTERED"].includes(event_type))
      return res.status(400).send({
        success: false,
        message: "Invalid event type!",
      });

    events = await eventsModel
      .find(
        createObject({
          _id: event_id,
          society,
          enrolled: event_type === "REGISTERED" ? _id : undefined,
          type: event_type !== "REGISTERED" ? event_type : undefined,
        }),
      )
      .select("_id title type image society description venue contact_info prize enrollment_start enrollment_end event_start event_end");

    res.status(200).send({
      success: true,
      message: "Events fetched successfully!",
      events,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while getting events!",
    });
  }
};

export const enrollUserController = async (req, res) => {
  const session = await startSession();
  try {
    const { _id } = req.user;

    const { event_id, enroll } = req.body;
    if (!event_id) return res.status(400).send({ success: false, message: "event_id missing!" });
    if (!["ENROLL", "UNENROLL"].includes(enroll)) return res.status(400).send({ success: false, message: "Invalid enroll action" });

    const event = await eventsModel.findById(event_id).select("-_id sheet_id enrollment_start enrollment_end");
    if (!event)
      return res.status(404).send({
        success: false,
        message: "Event not found!",
      });

    if (event.enrollment_start && Date.now() < new Date(event.enrollment_start).getTime())
      return res.status(409).send({
        success: false,
        message: "Event enrollment not started!",
      });
    if (event.enrollment_end && Date.now() > new Date(event.enrollment_end).getTime())
      return res.status(409).send({
        success: false,
        message: "Event enrollment ended!",
      });

    const user = await userModel.findById(_id).select("_id name email phone zeal_id");

    session.startTransaction();

    const eventUpdate = enroll === "ENROLL" ? { $addToSet: { enrolled: _id } } : { $pull: { enrolled: _id } };

    const eventRes = await eventsModel.updateOne({ _id: event_id }, eventUpdate, { session });

    if (!eventRes.modifiedCount)
      return res.status(200).send({
        success: false,
        message: `User already ${enroll.toLowerCase()}ed!`,
      });

    const rowData = [user._id, user.name, user.email, user.phone, user.zeal_id];

    if (enroll === "ENROLL") await addRowToSheet(event.sheet_id, rowData);
    else await removeRowFromSheet(event.sheet_id, 0, user._id.toString());

    await session.commitTransaction();

    res.status(200).send({
      success: true,
      message: `User ${enroll.toLowerCase()}ed successfully!`,
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while enrolling users!",
    });
  } finally {
    await session.endSession();
  }
};

export const createEventController = async (req, res) => {
  try {
    let eventsArray = req.body;

    if (!Array.isArray(eventsArray)) eventsArray = [eventsArray];

    const preparedEvents = await Promise.all(
      eventsArray.map(async (event, index) => {
        const { society, title, type, image, description, contactInfo, enrollmentStart, enrollmentEnd, eventStart, eventEnd, prize, venue } = event;
        if (!society || !SOCIETIES.includes(society)) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: society missing or invalid!` });
          return null;
        }
        if (!title) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: title missing!` });
          return null;
        }
        if (!type || !EVENT_TYPES.includes(type)) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: type missing or invalid!` });
          return null;
        }
        if (!image) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: image missing!` });
          return null;
        }
        if (!description) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: description missing!` });
          return null;
        }
        if (prize && !+prize) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: prize missing or invalid!` });
          return null;
        }
        if (enrollmentStart && !validateDate(enrollmentStart)) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: enrollmentStart invalid!` });
          return null;
        }
        if (enrollmentEnd && !validateDate(enrollmentEnd)) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: enrollmentEnd invalid!` });
          return null;
        }
        if (eventStart && !validateDate(eventStart)) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: eventStart invalid!` });
          return null;
        }
        if (eventEnd && !validateDate(eventEnd)) {
          res.status(400).send({ success: false, message: `Event ${index + 1}: eventEnd invalid!` });
          return null;
        }

        try {
          const sheet_id = await createSpreadsheet(title);
          await addRowToSheet(sheet_id, GSHEET_HEADERS);

          return createObject({
            society,
            sheet_id,
            title,
            type,
            image,
            description,
            contact_info: contactInfo,
            enrollment_start: enrollmentStart,
            enrollment_end: enrollmentEnd ?? eventEnd,
            event_start: eventStart,
            event_end: eventEnd,
            prize,
            venue,
          });
        } catch (err) {
          console.error(`Event ${index + 1}: Spreadsheet creation failed`, err);
          res.status(500).send({
            success: false,
            message: `Event ${index + 1}: Failed to set up spreadsheet`,
          });
          return null;
        }
      }),
    );

    if (preparedEvents.some((ev) => !ev)) return;

    await eventsModel.create(preparedEvents);

    res.status(201).send({
      success: true,
      message: "Events created successfully!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while creating events!",
    });
  }
};

export const getEventController = async (req, res) => {
  try {
    const { event_id } = req.params;
    if (!event_id) return res.status(400).send({ success: false, message: "event_id missing!" });

    const event = await eventsModel.findById(event_id).select("-_id society sheet_id title type description enrolled prize venue enrollment_start enrollment_end event_start event_end");
    if (!event)
      return res.status(404).send({
        success: false,
        message: "Event not found!",
      });

    res.status(200).send({
      success: true,
      message: "Event fetched successfully!",
      event: { ...event.toObject(), sheet_id: `https://docs.google.com/spreadsheets/d/${event.sheet_id}` },
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "admin: Error while getting event!",
    });
  }
};

export const updateEventController = async (req, res) => {
  try {
    const { event_id, society, title, type, image, description, contactInfo, enrollmentStart, enrollmentEnd, eventStart, eventEnd, prize, venue } = req.body;
    if (!event_id) return res.status(400).send({ success: false, message: "event_id missing!" });
    if (type && !EVENT_TYPES.includes(type)) return res.status(400).send({ success: false, message: "type invalid!" });
    if (enrollmentStart && !validateDate(enrollmentStart)) return res.status(400).send({ success: false, message: "enrollmentStart invalid!" });
    if (enrollmentEnd && !validateDate(enrollmentEnd)) return res.status(400).send({ success: false, message: "enrollmentEnd invalid!" });
    if (eventStart && !validateDate(eventStart)) return res.status(400).send({ success: false, message: "eventStart invalid!" });
    if (eventEnd && !validateDate(eventEnd)) return res.status(400).send({ success: false, message: "eventEnd invalid!" });
    const eventRes = await eventsModel.updateOne(
      { _id: event_id },
      {
        $set: createObject({
          society,
          title,
          type,
          image,
          description,
          contact_info: contactInfo,
          enrollment_start: enrollmentStart,
          enrollment_end: enrollmentEnd,
          event_start: eventStart,
          event_end: eventEnd,
          prize,
          venue,
        }),
      },
      { runValidators: true },
    );
    if (!eventRes.matchedCount)
      return res.status(404).send({
        success: false,
        message: "Event not found!",
      });

    res.status(200).send({
      success: true,
      message: "Event updated successfully!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while updating event!",
    });
  }
};

export const deleteEventController = async (req, res) => {
  try {
    const { event_id } = req.params;
    if (!event_id) return res.status(400).send({ success: false, message: "event_id missing!" });

    const event = await eventsModel.deleteOne({ _id: event_id });
    if (!event.deletedCount)
      return res.status(404).send({
        success: false,
        message: "Event not found!",
      });

    res.status(200).send({
      success: true,
      message: "Event deleted successfully!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while deleting event!",
    });
  }
};
