import { Router } from "express";
import { isLoggedIn, isSocietyAdmin } from "../middlewares/authMiddleware.js";
import { createEventController, deleteEventController, enrollUserController, getEventController, getEventsController, updateEventController } from "../controllers/eventsController.js";
import { reqEveryNSeconds } from "../middlewares/rateLimitterMiddleware.js";

const eventsRouter = Router();

eventsRouter.use(isLoggedIn);

eventsRouter.get("/get", reqEveryNSeconds(0.5), getEventsController); //use query society and event_id and event_type to filter events

eventsRouter.post("/enroll", reqEveryNSeconds(2), enrollUserController);

eventsRouter.use(isSocietyAdmin);

eventsRouter.post("/admin/create", reqEveryNSeconds(1), createEventController);

eventsRouter.get("/admin/get/:event_id", reqEveryNSeconds(1), getEventController);

eventsRouter.patch("/admin/update", reqEveryNSeconds(1), updateEventController);

eventsRouter.delete("/admin/delete/:event_id", deleteEventController);

export { eventsRouter };
