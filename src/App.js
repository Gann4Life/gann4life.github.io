import React, { useState, useEffect } from "react";
import Portfolio from "./components/Portfolio"

const App = () => {
  const [projects, setProjects] = useState([])
  
  useEffect(() => {
    const getProjects = async () => {
      const projectsFromServer = await fetchProjects()
      setProjects(projectsFromServer)
    }
    getProjects()
  }, [])

  // Fetch projects from CodersRank
  const fetchProjects = async() => {
    const url = "https://api.codersrank.io/v2/users/gann4life/projects?get_by=username"
    const res = await fetch(url)
    const data = await res.json()
    return data.projects
  }

  return (
      <div className="app container-fluid py-5 text-center">
          <div className="container my-5">
            <h1 className="text-white">Portfolio</h1>
            <input placeholder="Search..."></input>
            <hr></hr>
            {projects.length > 0 
            ? <Portfolio projects={projects}/>
            : ""
            }
          </div>
      </div>
  );
}

export default App;
