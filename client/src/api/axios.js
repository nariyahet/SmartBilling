import axios from "axios";

const API = axios.create({
  baseURL: "https://smartbilling-api-het.onrender.com/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default API;