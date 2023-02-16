import React, { useState, useEffect } from "react";
import Header from "./components/Header"
import Portfolio from "./components/Portfolio"

const App = () => {
	const [projects, setProjects] = useState([])
	const [information, setInformation] = useState([])
	
	useEffect(() => {
		const getProjects = async () => {
			const projectsFromServer = await fetchProjects()
			setProjects(projectsFromServer)
		}
		const getInformation = async() => {
			const informationFromServer = await fetchInformation()
			setInformation(informationFromServer)
		}

		getProjects()
		getInformation()
	}, [])

	// Fetch projects from CodersRank
	const fetchProjects = async() => {
		const data = await fetchJson("https://api.codersrank.io/v2/users/gann4life/projects?get_by=username")
		return data.projects
	}

	// Fetch personal information
	const fetchInformation = async() => await fetchJson("https://api.codersrank.io/v2/users/gann4life?get_by=username")

	// Returns an object from URL
	const fetchJson = async(url) => {
		const res = await fetch(url)
		//const data = await res.json()
		return await res.json()
	}

	return (
		<div className="app container-fluid py-1 text-center">
			<div className="container my-5">
				<Header data={information}/>
				<hr></hr>
				{projects.length > 0 ? <Portfolio projects={projects}/> : ""}
			</div>
		</div>
	);
}

export default App;
